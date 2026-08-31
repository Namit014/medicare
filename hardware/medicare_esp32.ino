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
  GET  {SERVER_BASE}/api/device/schedule?deviceId=DEVICE_ID
       -> 200 OK
       -> {"success":true,
           "deviceId":"MED-DEA224",
           "morning":"08:00",
           "afternoon":"14:00",
           "night":"20:00",
           "active":true,
           "taken":{"morning":false,"afternoon":false,"night":false}}

  POST {SERVER_BASE}/api/device/status
       Content-Type: application/json
       -> {"deviceId":"MED-DEA224","slot":"morning","status":"taken","date":"2026-08-31"}
       status is one of: "taken", "reset"
*/

#include <Wire.h>
#include <RTClib.h>
#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>

// ---------- Wi-Fi + backend config ----------
const char* WIFI_SSID     = "chotelog";
const char* WIFI_PASSWORD = "omsaibaba";
const char* SERVER_BASE   = "http://192.168.1.103:3000";
const char* DEVICE_ID     = "MED-DEA224";

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
  { 8, 0 },   // Morning   8:00 AM
  { 14, 0 },  // Afternoon 2:00 PM
  { 20, 0 }   // Night     8:00 PM
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
// Pulls schedule from: GET /api/device/schedule?deviceId=MED-DEA224
// Response: {"morning":"08:00","afternoon":"14:00","night":"20:00","active":true,"taken":{...}}
void fetchSchedule() {
  if (WiFi.status() != WL_CONNECTED) return;

  HTTPClient http;
  String url = String(SERVER_BASE) + "/api/device/schedule?deviceId=" + DEVICE_ID;
  http.begin(url);
  int code = http.GET();

  if (code == 200) {
    String body = http.getString();
    StaticJsonDocument<512> doc;
    DeserializationError err = deserializeJson(doc, body);
    if (!err) {
      // Parse "HH:MM" time strings into hour and minute integers
      const char* slots[3] = { "morning", "afternoon", "night" };
      for (int i = 0; i < 3; i++) {
        const char* timeStr = doc[slots[i]] | nullptr;
        if (timeStr) {
          int h = 0, m = 0;
          if (sscanf(timeStr, "%d:%d", &h, &m) == 2) {
            schedule[i].hour = h;
            schedule[i].minute = m;
          }
        }
      }
      Serial.printf("Schedule updated from server: %02d:%02d / %02d:%02d / %02d:%02d\n",
                     schedule[0].hour, schedule[0].minute,
                     schedule[1].hour, schedule[1].minute,
                     schedule[2].hour, schedule[2].minute);
    } else {
      Serial.println("Schedule JSON parse failed - using existing/default times.");
    }
  } else {
    Serial.printf("Could not reach server (HTTP %d) - using existing/default schedule.\n", code);
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
// Sends dose event to: POST /api/device/status
// Body: {"deviceId":"MED-DEA224","slot":"morning","status":"taken","date":"2026-08-31"}
void sendDoseEvent(const char* slot, const char* status, DateTime now) {
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("WiFi not connected - event logged locally only.");
    return;
  }

  HTTPClient http;
  http.begin(String(SERVER_BASE) + "/api/device/status");
  http.addHeader("Content-Type", "application/json");

  StaticJsonDocument<256> doc;
  doc["deviceId"] = DEVICE_ID;
  doc["slot"] = slot;
  doc["status"] = status;

  // Build date string: "YYYY-MM-DD"
  char dateStr[11];
  snprintf(dateStr, sizeof(dateStr), "%04d-%02d-%02d",
           now.year(), now.month(), now.day());
  doc["date"] = dateStr;

  String payload;
  serializeJson(doc, payload);

  int code = http.POST(payload);
  if (code > 0) {
    Serial.printf("Sent %s event for %s slot, server responded %d\n", status, slot, code);
    String response = http.getString();
    Serial.println(response);
  } else {
    Serial.printf("Failed to send %s event for %s slot, error: %d\n", status, slot, code);
  }
  http.end();
}
