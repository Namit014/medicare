/*
  MedBuddy - Smart Medicine Reminder
  ESP32 firmware: Morning / Afternoon / Night reminder with sensor-confirmed shutoff.

  RULE: The buzzer turns OFF only when that slot's own IR sensor confirms the pill
  was removed. There is no mute button and no timeout cap - by design. A "missed"
  event is logged to the website after MISSED_THRESHOLD_MS, but that log entry does
  NOT silence the buzzer - the hardware keeps enforcing the rule regardless.

  TIME SYNC: Uses NTP (Network Time Protocol) over WiFi instead of a hardware RTC.
  The DS3231 module is NOT required. Time is synced on boot and re-synced every hour.

  ------------------------------------------------------------------
  WIRING
  ------------------------------------------------------------------
  IR Sensor Morning    OUT -> GPIO4    VCC -> 5V(VIN)   GND -> GND
  IR Sensor Afternoon  OUT -> GPIO5    VCC -> 5V(VIN)   GND -> GND
  IR Sensor Night      OUT -> GPIO18   VCC -> 5V(VIN)   GND -> GND
  LED Morning    Anode -> GPIO19 (through 220ohm resistor)   Cathode -> GND
  LED Afternoon  Anode -> GPIO23 (through  220ohm resistor)   Cathode -> GND
  LED Night      Anode -> GPIO25 (through 220ohm resistor)   Cathode -> GND
  Buzzer  Signal -> GPIO26   GND -> GND

  ------------------------------------------------------------------
  LIBRARIES REQUIRED (Arduino IDE Library Manager)
  ------------------------------------------------------------------
  - ArduinoJson   by Benoit Blanchon
  - WiFi.h, HTTPClient.h, time.h ship with the ESP32 board package
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

#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>
#include <time.h>
#include <WiFiManager.h>
#include <Preferences.h>

Preferences preferences;
String server_base = "";
String device_id = "";
bool shouldSaveConfig = false;

void saveConfigCallback() {
  shouldSaveConfig = true;
}

// ---------- NTP config ----------
const char* NTP_SERVER    = "pool.ntp.org";
const long  GMT_OFFSET_SEC = 19800;  // IST (UTC+5:30) — adjust for your timezone
const int   DST_OFFSET_SEC = 0;

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
String slot_id[3]    = { "", "", "" }; // Dynamic slot IDs from server

int  lastResetDay = -1;
bool timeReady = false;
struct tm timeinfo;

// ---------------------------------------------------------------
void setup() {
  Serial.begin(115200);
  delay(300);

  for (int i = 0; i < 3; i++) {
    pinMode(SENSOR_PIN[i], INPUT);
    pinMode(LED_PIN[i], OUTPUT);
    digitalWrite(LED_PIN[i], LOW);
  }
  pinMode(BUZZER_PIN, OUTPUT);
  digitalWrite(BUZZER_PIN, LOW);

  preferences.begin("medicare", false);
  server_base = preferences.getString("server", "http://192.168.1.103:3000");
  device_id = preferences.getString("deviceid", "");

  WiFiManager wm;
  wm.setSaveConfigCallback(saveConfigCallback);
  
  WiFiManagerParameter custom_server("server", "Server URL", server_base.c_str(), 60);
  WiFiManagerParameter custom_deviceid("deviceid", "Hardware Link ID", device_id.c_str(), 20);
  
  wm.addParameter(&custom_server);
  wm.addParameter(&custom_deviceid);

  Serial.println("Starting WiFiManager...");
  if (!wm.autoConnect("MediCare-Setup")) {
    Serial.println("Failed to connect to WiFi. Restarting...");
    delay(3000);
    ESP.restart();
  }

  if (shouldSaveConfig) {
    server_base = custom_server.getValue();
    device_id = custom_deviceid.getValue();
    preferences.putString("server", server_base);
    preferences.putString("deviceid", device_id);
    Serial.println("Saved new config to flash memory!");
  }
  preferences.end();
  Serial.print("Connected! IP: ");
  Serial.println(WiFi.localIP());

  configTime(GMT_OFFSET_SEC, DST_OFFSET_SEC, NTP_SERVER);
  timeReady = getLocalTime(&timeinfo);
  if (!timeReady) {
    Serial.println("NTP sync failed - time may be incorrect until sync succeeds.");
  }
  fetchSchedule();   // pulls Morning/Afternoon/Night times set on the website, if reachable
  lastScheduleFetch = millis();
}

// ---------------------------------------------------------------
void loop() {
  timeReady = getLocalTime(&timeinfo);
  if (!timeReady) {
    Serial.println("NTP re-sync failed this cycle.");
    delay(500);
    return;
  }
  resetIfNewDay(timeinfo);

  if (millis() - lastScheduleFetch > SCHEDULE_REFRESH_MS) {
    fetchSchedule();   // picks up any time the caregiver just changed on the website
    lastScheduleFetch = millis();
  }

  checkSchedule(timeinfo);
  checkSensors(timeinfo);
  checkMissed(timeinfo);
  updateBuzzer();
  delay(500);
}

// ---------------------------------------------------------------
// Pulls schedule from API
// Response: {"success":true,"active":true,"slots":[{"id":"123","time":"08:00"}],"taken":{...}}
void fetchSchedule() {
  if (WiFi.status() != WL_CONNECTED) return;
  if (device_id == "") {
    Serial.println("No Device ID configured. Please reset and connect to setup portal.");
    return;
  }

  HTTPClient http;
  String url = server_base + "/api/device/schedule?deviceId=" + device_id;
  http.begin(url);
  int code = http.GET();

  if (code == 200) {
    String body = http.getString();
    StaticJsonDocument<1024> doc; // Increased size for array
    DeserializationError err = deserializeJson(doc, body);
    if (!err) {
      JsonArray slotsArr = doc["slots"].as<JsonArray>();
      int idx = 0;
      for (JsonObject s : slotsArr) {
        if (idx >= 3) break; // Hardware limit of 3 physical slots
        const char* timeStr = s["time"];
        const char* idStr = s["id"];
        if (timeStr && idStr) {
          int h = 0, m = 0;
          if (sscanf(timeStr, "%d:%d", &h, &m) == 2) {
            schedule[idx].hour = h;
            schedule[idx].minute = m;
            slot_id[idx] = String(idStr);
            idx++;
          }
        }
      }
      
      // If fewer than 3 pills are scheduled today, disable the remaining hardware slots
      for (int i = idx; i < 3; i++) {
         slot_id[i] = "";
         schedule[i].hour = 99; // Never triggered
         schedule[i].minute = 99;
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
void resetIfNewDay(struct tm &t) {
  if (t.tm_mday != lastResetDay) {
    for (int i = 0; i < 3; i++) {
      due[i] = false;
      resolved[i] = false;
      missedLogged[i] = false;
      digitalWrite(LED_PIN[i], LOW);
    }
    lastResetDay = t.tm_mday;
    fetchSchedule();   // pick up any schedule change made on the website overnight
    Serial.println("New day - all slots reset.");
  }
}

// ---------------------------------------------------------------
void checkSchedule(struct tm &t) {
  for (int i = 0; i < 3; i++) {
    if (slot_id[i] == "") continue; // Skip unused slots
    if (!due[i] && t.tm_hour == schedule[i].hour && t.tm_min == schedule[i].minute) {
      due[i] = true;
      dueMillis[i] = millis();
      digitalWrite(LED_PIN[i], HIGH);
      Serial.printf("[%02d:%02d:%02d] Slot %d -> BUZZER ON\n",
                     t.tm_hour, t.tm_min, t.tm_sec, i);
    }
  }
}

// ---------------------------------------------------------------
void checkSensors(struct tm &t) {
  for (int i = 0; i < 3; i++) {
    if (slot_id[i] == "") continue;
    if (due[i] && !resolved[i]) {
      int reading = digitalRead(SENSOR_PIN[i]);
      if (reading == SENSOR_ACTIVE_STATE) {
        resolved[i] = true;
        digitalWrite(LED_PIN[i], LOW);
        Serial.printf("[%02d:%02d:%02d] Slot %d -> pill removed, BUZZER OFF, logged TAKEN\n",
                       t.tm_hour, t.tm_min, t.tm_sec, i);
        sendDoseEvent(slot_id[i].c_str(), "taken", t);
      }
    }
  }
}

// ---------------------------------------------------------------
// Logs a "missed" event once, for dashboard visibility only - does NOT touch the buzzer.
void checkMissed(struct tm &t) {
  for (int i = 0; i < 3; i++) {
    if (slot_id[i] == "") continue;
    if (due[i] && !resolved[i] && !missedLogged[i] &&
        (millis() - dueMillis[i] > MISSED_THRESHOLD_MS)) {
      missedLogged[i] = true;
      Serial.printf("[%02d:%02d:%02d] Slot %d -> still not picked up, logged MISSED (buzzer still ON)\n",
                     t.tm_hour, t.tm_min, t.tm_sec, i);
      sendDoseEvent(slot_id[i].c_str(), "missed", t);
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
// Body: {"deviceId":"MED-DEA224","slotId":"123","status":"taken","date":"2026-08-31"}
void sendDoseEvent(const char* slotId, const char* status, struct tm &t) {
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("WiFi not connected - event logged locally only.");
    return;
  }

  HTTPClient http;
  http.begin(server_base + "/api/device/status");
  http.addHeader("Content-Type", "application/json");

  StaticJsonDocument<256> doc;
  doc["deviceId"] = device_id;
  doc["slotId"] = slotId; // Updated to match API expectation
  doc["status"] = status;

  // Build date string: "YYYY-MM-DD"
  char dateStr[11];
  snprintf(dateStr, sizeof(dateStr), "%04d-%02d-%02d",
           t.tm_year + 1900, t.tm_mon + 1, t.tm_mday);
  doc["date"] = dateStr;

  String payload;
  serializeJson(doc, payload);

  int code = http.POST(payload);
  if (code > 0) {
    Serial.printf("Sent %s event for %s slot, server responded %d\n", status, slotId, code);
    String response = http.getString();
    Serial.println(response);
  } else {
    Serial.printf("Failed to send %s event for %s slot, error: %d\n", status, slotId, code);
  }
  http.end();
}
