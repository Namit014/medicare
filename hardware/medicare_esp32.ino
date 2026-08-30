/*
  MedBuddy - Smart Medicine Reminder
  ESP32 firmware: Morning / Afternoon / Night reminder with sensor-confirmed shutoff.

  RULE: The buzzer turns OFF only when that slot's own IR sensor confirms the pill
  was removed. There is no mute button and no timeout cap - by design. A "missed"
  event is logged to the website after MISSED_THRESHOLD_MS, but that log entry does
  NOT silence the buzzer - the hardware keeps enforcing the rule regardless.

  ------------------------------------------------------------------
  WIRING
  ------------------------------------------------------------------
  DS3231 RTC           SDA -> GPIO21   SCL -> GPIO22   VCC -> 3V3   GND -> GND
  IR Sensor Morning    OUT -> GPIO4    VCC -> 5V(VIN)   GND -> GND
  IR Sensor Afternoon  OUT -> GPIO5    VCC -> 5V(VIN)   GND -> GND
  IR Sensor Night      OUT -> GPIO18   VCC -> 5V(VIN)   GND -> GND
  LED Morning    Anode -> GPIO19 (through 220ohm resistor)   Cathode -> GND
  LED Afternoon  Anode -> GPIO23 (through 220ohm resistor)   Cathode -> GND
  LED Night      Anode -> GPIO25 (through 220ohm resistor)   Cathode -> GND
  Buzzer  Signal -> GPIO26   GND -> GND

  ------------------------------------------------------------------
  LIBRARIES REQUIRED (Arduino IDE Library Manager)
  ------------------------------------------------------------------
  - RTClib        by Adafruit
  - ArduinoJson   by Benoit Blanchon
  - WiFi.h and HTTPClient.h ship with the ESP32 board package
    (Boards Manager -> install "esp32 by Espressif Systems")

  ------------------------------------------------------------------
  WEBSITE API CONTRACT THIS FIRMWARE EXPECTS
  ------------------------------------------------------------------
  GET  {SERVER_BASE}/api/schedule?device_id=medbuddy01
       -> 200 OK
       -> {"morning":{"hour":9,"minute":0},
           "afternoon":{"hour":14,"minute":0},
           "night":{"hour":21,"minute":0}}

  POST {SERVER_BASE}/api/dose-log
       Content-Type: application/json
       -> {"device_id":"medbuddy01","slot":"morning","status":"taken",
           "timestamp":"2026-08-30T09:03:12"}
       status is one of: "taken", "missed"
*/

#include <Wire.h>
#include <RTClib.h>
#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>

// ---------- Wi-Fi + backend config ----------
const char* WIFI_SSID     = "chotelog";
const char* WIFI_PASSWORD = "omsaibaba";
const char* SERVER_BASE   = "http://192.168.1.103:3000";   // your FastAPI backend
const char* DEVICE_ID     = "medbuddy01";

// ---------- Pin assignments ----------
const int SENSOR_PIN[3] = { 4, 5, 18 };   // Morning, Afternoon, Night
const int LED_PIN[3]    = { 19, 23, 25 };
const int BUZZER_PIN    = 26;

// Most IR break-beam / obstacle modules pull the OUT pin LOW when the beam is
// broken (pill removed). Check yours with a quick Serial.println() test first -
// if it's backwards, flip this to HIGH.
const int SENSOR_ACTIVE_STATE = LOW;

const char* SLOT_NAME[3] = { "morning", "afternoon", "night" };

// Log (but don't silence) a slot as "missed" if it's been unresolved this long.
const unsigned long MISSED_THRESHOLD_MS = 15UL * 60UL * 1000UL; // 15 minutes

// Re-check the website for schedule changes this often, so a caregiver editing
// the Morning/Afternoon/Night time on the site doesn't have to wait until midnight
// for the device to notice.
const unsigned long SCHEDULE_REFRESH_MS = 5UL * 60UL * 1000UL; // 5 minutes
unsigned long lastScheduleFetch = 0;

// ---------- Schedule (fallback defaults; overwritten by fetchSchedule()) ----------
struct DoseTime { int hour; int minute; };
DoseTime schedule[3] = {
  { 9, 0 },   // Morning   9:00 AM
  { 14, 0 },  // Afternoon 2:00 PM
  { 21, 0 }   // Night     9:00 PM
};

// ---------- Per-slot state ----------
bool due[3]          = { false, false, false }; // scheduled time has arrived today
bool resolved[3]     = { false, false, false }; // pill has been picked up today
bool missedLogged[3] = { false, false, false }; // "missed" already sent today
unsigned long dueMillis[3] = { 0, 0, 0 };
int  lastResetDay = -1;

RTC_DS3231 rtc;

// ---------------------------------------------------------------
void setup() {
  Serial.begin(115200);
  delay(300);

  Wire.begin();
  if (!rtc.begin()) {
    Serial.println("RTC not found - check wiring.");
  }
  // Uncomment ONCE to set the RTC to your computer's clock, upload, then
  // re-comment this line and upload again (otherwise it resets time on every boot):
  // rtc.adjust(DateTime(F(__DATE__), F(__TIME__)));

  for (int i = 0; i < 3; i++) {
    pinMode(SENSOR_PIN[i], INPUT);
    pinMode(LED_PIN[i], OUTPUT);
    digitalWrite(LED_PIN[i], LOW);
  }
  pinMode(BUZZER_PIN, OUTPUT);
  digitalWrite(BUZZER_PIN, LOW);

  connectWiFi();
  fetchSchedule();   // pulls Morning/Afternoon/Night times set on the website, if reachable
  lastScheduleFetch = millis();
}

// ---------------------------------------------------------------
void loop() {
  DateTime now = rtc.now();
  resetIfNewDay(now);

  if (millis() - lastScheduleFetch > SCHEDULE_REFRESH_MS) {
    fetchSchedule();   // picks up any time the caregiver just changed on the website
    lastScheduleFetch = millis();
  }

  checkSchedule(now);
  checkSensors(now);
  checkMissed(now);
  updateBuzzer();
  delay(500);
}

// ---------------------------------------------------------------
void connectWiFi() {
  Serial.print("Connecting to WiFi");
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  int attempts = 0;
  while (WiFi.status() != WL_CONNECTED && attempts < 20) {
    delay(500);
    Serial.print(".");
    attempts++;
  }
  Serial.println();
  if (WiFi.status() == WL_CONNECTED) {
    Serial.print("WiFi connected, IP: ");
    Serial.println(WiFi.localIP());
  } else {
    Serial.println("WiFi not connected - running on RTC + default schedule only.");
  }
}

// ---------------------------------------------------------------
// Pulls {"morning":{"hour":9,"minute":0}, "afternoon":{...}, "night":{...}} from the website.
void fetchSchedule() {
  if (WiFi.status() != WL_CONNECTED) return;

  HTTPClient http;
  String url = String(SERVER_BASE) + "/api/schedule?device_id=" + DEVICE_ID;
  http.begin(url);
  int code = http.GET();

  if (code == 200) {
    String body = http.getString();
    StaticJsonDocument<512> doc;
    DeserializationError err = deserializeJson(doc, body);
    if (!err) {
      schedule[0].hour   = doc["morning"]["hour"]     | schedule[0].hour;
      schedule[0].minute = doc["morning"]["minute"]   | schedule[0].minute;
      schedule[1].hour   = doc["afternoon"]["hour"]   | schedule[1].hour;
      schedule[1].minute = doc["afternoon"]["minute"] | schedule[1].minute;
      schedule[2].hour   = doc["night"]["hour"]       | schedule[2].hour;
      schedule[2].minute = doc["night"]["minute"]     | schedule[2].minute;
      Serial.println("Schedule updated from server.");
    } else {
      Serial.println("Schedule JSON parse failed - using existing/default times.");
    }
  } else {
    Serial.println("Could not reach server - using existing/default schedule.");
  }
  http.end();
}

// ---------------------------------------------------------------
void resetIfNewDay(DateTime now) {
  if (now.day() != lastResetDay) {
    for (int i = 0; i < 3; i++) {
      due[i] = false;
      resolved[i] = false;
      missedLogged[i] = false;
      digitalWrite(LED_PIN[i], LOW);
    }
    lastResetDay = now.day();
    fetchSchedule();   // pick up any schedule change made on the website overnight
    Serial.println("New day - all slots reset.");
  }
}

// ---------------------------------------------------------------
void checkSchedule(DateTime now) {
  for (int i = 0; i < 3; i++) {
    if (!due[i] && now.hour() == schedule[i].hour && now.minute() == schedule[i].minute) {
      due[i] = true;
      dueMillis[i] = millis();
      digitalWrite(LED_PIN[i], HIGH);
      Serial.printf("[%02d:%02d:%02d] %s slot -> BUZZER ON\n",
                     now.hour(), now.minute(), now.second(), SLOT_NAME[i]);
    }
  }
}

// ---------------------------------------------------------------
void checkSensors(DateTime now) {
  for (int i = 0; i < 3; i++) {
    if (due[i] && !resolved[i]) {
      int reading = digitalRead(SENSOR_PIN[i]);
      if (reading == SENSOR_ACTIVE_STATE) {
        resolved[i] = true;
        digitalWrite(LED_PIN[i], LOW);
        Serial.printf("[%02d:%02d:%02d] %s slot -> pill removed, BUZZER OFF, logged TAKEN\n",
                       now.hour(), now.minute(), now.second(), SLOT_NAME[i]);
        sendDoseEvent(SLOT_NAME[i], "taken", now);
      }
    }
  }
}

// ---------------------------------------------------------------
// Logs a "missed" event once, for dashboard visibility only - does NOT touch the buzzer.
void checkMissed(DateTime now) {
  for (int i = 0; i < 3; i++) {
    if (due[i] && !resolved[i] && !missedLogged[i] &&
        (millis() - dueMillis[i] > MISSED_THRESHOLD_MS)) {
      missedLogged[i] = true;
      Serial.printf("[%02d:%02d:%02d] %s slot -> still not picked up, logged MISSED (buzzer still ON)\n",
                     now.hour(), now.minute(), now.second(), SLOT_NAME[i]);
      sendDoseEvent(SLOT_NAME[i], "missed", now);
    }
  }
}

// ---------------------------------------------------------------
// Buzzer is ON if ANY slot is due and not yet resolved - stays on until that pill is picked up.
void updateBuzzer() {
  bool anyUnresolved = false;
  for (int i = 0; i < 3; i++) {
    if (due[i] && !resolved[i]) anyUnresolved = true;
  }
  digitalWrite(BUZZER_PIN, anyUnresolved ? HIGH : LOW);
}

// ---------------------------------------------------------------
void sendDoseEvent(const char* slot, const char* status, DateTime now) {
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("WiFi not connected - event logged locally only.");
    return;
  }

  HTTPClient http;
  http.begin(String(SERVER_BASE) + "/api/dose-log");
  http.addHeader("Content-Type", "application/json");

  StaticJsonDocument<256> doc;
  doc["device_id"] = DEVICE_ID;
  doc["slot"] = slot;
  doc["status"] = status;
  char ts[25];
  snprintf(ts, sizeof(ts), "%04d-%02d-%02dT%02d:%02d:%02d",
           now.year(), now.month(), now.day(), now.hour(), now.minute(), now.second());
  doc["timestamp"] = ts;

  String payload;
  serializeJson(doc, payload);

  int code = http.POST(payload);
  Serial.printf("Sent %s event for %s slot, server responded %d\n", status, slot, code);
  http.end();
}