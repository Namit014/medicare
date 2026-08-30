/**
 * Medicare ESP32 Pill Reminder System Sketch
 * 
 * Hardware Requirements:
 * - ESP32 Development Board
 * - DS3231 RTC Module (I2C)
 * - 3x Pill Removal Sensors (e.g., switches/limit switches or infrared sensors)
 * - 3x LED Indicators (Morning, Afternoon, Night)
 * - 1x Active Buzzer
 * - 1x Push Button (Manual Mute)
 * 
 * Instructions:
 * 1. Update the Wi-Fi credentials (WIFI_SSID, WIFI_PASSWORD) below.
 * 2. Update the HOST_SERVER address to point to your deployed Medicare server or local IP.
 * 3. Update the DEVICE_ID to match the ID registered in your user dashboard.
 * 4. Install the required libraries via the Arduino Library Manager:
 *    - "ArduinoJson" by Benoit Blanchon (v6 or v7)
 *    - "RTClib" by Adafruit
 */

#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>
#include <Wire.h>
#include <RTClib.h>

// Wi-Fi Config
const char* WIFI_SSID = "YOUR_WIFI_SSID";
const char* WIFI_PASSWORD = "YOUR_WIFI_PASSWORD";

// Server Config
// Replace with your local machine's IP (e.g. "http://192.168.1.100:3000") or your production URL (e.g. "https://medicare.vercel.app")
const char* HOST_SERVER = "http://192.168.1.100:3000";
const char* DEVICE_ID = "MED-XXXXXX"; // Change this to your linked Device ID from the web dashboard

// Hardware Pin Definitions
#define PIN_LED_MORNING     12  // LED for Morning Slot
#define PIN_LED_AFTERNOON   14  // LED for Afternoon Slot
#define PIN_LED_NIGHT       27  // LED for Night Slot

#define PIN_SENSOR_MORNING   32  // Switch/sensor for Morning Slot (HIGH = pill present, LOW = pill removed)
#define PIN_SENSOR_AFTERNOON 33  // Switch/sensor for Afternoon Slot
#define PIN_SENSOR_NIGHT     34  // Switch/sensor for Night Slot

#define PIN_BUZZER           25  // Active buzzer
#define PIN_MUTE_BUTTON      26  // Manual button to mute alarm buzzer

// Global Objects
RTC_DS3231 rtc;
HTTPClient http;

// Scheduling & Alarm States
String schedMorning = "08:00";
String schedAfternoon = "14:00";
String schedNight = "20:00";

bool takenMorning = false;
bool takenAfternoon = false;
bool takenNight = false;

bool alarmMuted = false;
unsigned long lastPollTime = 0;
const unsigned long pollInterval = 10000; // Poll server every 10 seconds

void setup() {
  Serial.begin(115200);
  
  // Configure Pins
  pinMode(PIN_LED_MORNING, OUTPUT);
  pinMode(PIN_LED_AFTERNOON, OUTPUT);
  pinMode(PIN_LED_NIGHT, OUTPUT);
  
  pinMode(PIN_SENSOR_MORNING, INPUT_PULLUP);
  pinMode(PIN_SENSOR_AFTERNOON, INPUT_PULLUP);
  pinMode(PIN_SENSOR_NIGHT, INPUT_PULLUP);
  
  pinMode(PIN_BUZZER, OUTPUT);
  pinMode(PIN_MUTE_BUTTON, INPUT_PULLUP);
  
  digitalWrite(PIN_LED_MORNING, LOW);
  digitalWrite(PIN_LED_AFTERNOON, LOW);
  digitalWrite(PIN_LED_NIGHT, LOW);
  digitalWrite(PIN_BUZZER, LOW);

  // Initialize I2C and RTC
  Wire.begin();
  if (!rtc.begin()) {
    Serial.println("Warning: Couldn't find RTC module! Falling back to ESP32 system clock.");
  } else if (rtc.lostPower()) {
    Serial.println("RTC lost power, setting time to compile time.");
    rtc.adjust(DateTime(F(__DATE__), F(__TIME__)));
  }

  // Connect to Wi-Fi
  connectWiFi();
}

void loop() {
  // Ensure Wi-Fi remains connected
  if (WiFi.status() != WL_CONNECTED) {
    connectWiFi();
  }

  DateTime now = rtc.now();
  int currentHour = now.hour();
  int currentMinute = now.minute();
  
  char timeBuffer[6];
  sprintf(timeBuffer, "%02d:%02d", currentHour, currentMinute);
  String currentTimeStr = String(timeBuffer);

  // Periodic poll to fetch latest routine settings & taken statuses
  if (millis() - lastPollTime >= pollInterval) {
    fetchSchedule(currentTimeStr);
    lastPollTime = millis();
  }

  // Check mute button status (pressed when PIN_MUTE_BUTTON reads LOW)
  if (digitalRead(PIN_MUTE_BUTTON) == LOW) {
    alarmMuted = true;
    Serial.println("Alarm manually muted.");
    delay(200); // Debounce delay
  }

  // Handle Alarms for Morning, Afternoon, and Night Slots
  checkAndAlert("morning", schedMorning, takenMorning, PIN_SENSOR_MORNING, PIN_LED_MORNING, currentTimeStr);
  checkAndAlert("afternoon", schedAfternoon, takenAfternoon, PIN_SENSOR_AFTERNOON, PIN_LED_AFTERNOON, currentTimeStr);
  checkAndAlert("night", schedNight, takenNight, PIN_SENSOR_NIGHT, PIN_LED_NIGHT, currentTimeStr);

  delay(100);
}

void connectWiFi() {
  Serial.print("Connecting to Wi-Fi: ");
  Serial.println(WIFI_SSID);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  
  int attempts = 0;
  while (WiFi.status() != WL_CONNECTED && attempts < 20) {
    delay(500);
    Serial.print(".");
    attempts++;
  }
  
  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("\nWi-Fi Connected successfully.");
    Serial.print("IP Address: ");
    Serial.println(WiFi.localIP());
  } else {
    Serial.println("\nWi-Fi Connection failed. Will retry in loop.");
  }
}

void fetchSchedule(String currentTimeStr) {
  if (WiFi.status() != WL_CONNECTED) return;

  // Construct URL with device ID and current date
  // e.g. /api/device/schedule?deviceId=MED-123&time=08:15
  String url = String(HOST_SERVER) + "/api/device/schedule?deviceId=" + String(DEVICE_ID);
  
  Serial.print("Polling Server: ");
  Serial.println(url);

  http.begin(url);
  int httpCode = http.GET();

  if (httpCode == HTTP_CODE_OK) {
    String payload = http.getString();
    
    StaticJsonDocument<512> doc;
    DeserializationError error = deserializeJson(doc, payload);

    if (!error) {
      // Sync configurations
      schedMorning = doc["morning"].as<String>();
      schedAfternoon = doc["afternoon"].as<String>();
      schedNight = doc["night"].as<String>();
      
      takenMorning = doc["taken"]["morning"].as<bool>();
      takenAfternoon = doc["taken"]["afternoon"].as<bool>();
      takenNight = doc["taken"]["night"].as<bool>();

      Serial.println("Schedule synchronized successfully:");
      Serial.printf("  Morning: %s (Taken: %d)\n", schedMorning.c_str(), takenMorning);
      Serial.printf("  Afternoon: %s (Taken: %d)\n", schedAfternoon.c_str(), takenAfternoon);
      Serial.printf("  Night: %s (Taken: %d)\n", schedNight.c_str(), takenNight);
    } else {
      Serial.print("JSON parsing failed: ");
      Serial.println(error.c_str());
    }
  } else {
    Serial.printf("HTTP Poll failed, error: %s\n", http.errorToString(httpCode).c_str());
  }
  http.end();
}

void checkAndAlert(String slot, String schedTime, bool &isTaken, int sensorPin, int ledPin, String currentTimeStr) {
  // If the pill has already been taken, turn off alarms and do nothing
  if (isTaken) {
    digitalWrite(ledPin, LOW);
    return;
  }

  // Parse hours and minutes
  int curHours = currentTimeStr.substring(0, 2).toInt();
  int curMins = currentTimeStr.substring(3, 5).toInt();
  int schHours = schedTime.substring(0, 2).toInt();
  int schMins = schedTime.substring(3, 5).toInt();

  long currentTotalMinutes = curHours * 60 + curMins;
  long scheduledTotalMinutes = schHours * 60 + schMins;
  long activeWindowMinutes = 180; // 3 hours window

  // If we are currently within the due window (scheduled time up to 3 hours later)
  if (currentTotalMinutes >= scheduledTotalMinutes && currentTotalMinutes < (scheduledTotalMinutes + activeWindowMinutes)) {
    
    // Check if the pill is physically present or removed
    // HIGH means pill is in place, LOW means pill is removed (compartment open/empty)
    int sensorState = digitalRead(sensorPin);

    if (sensorState == LOW) {
      // Pill is taken! Turn off alarms and report to backend
      digitalWrite(ledPin, LOW);
      digitalWrite(PIN_BUZZER, LOW);
      isTaken = true;
      alarmMuted = false;
      reportPillTaken(slot);
    } else {
      // Pill is still there! Trigger warnings
      // Turn on LED indicator
      digitalWrite(ledPin, HIGH);

      // Sound buzzer if not manually muted
      if (!alarmMuted) {
        // Pulse the buzzer (beep beep)
        digitalWrite(PIN_BUZZER, HIGH);
        delay(100);
        digitalWrite(PIN_BUZZER, LOW);
      }
    }
  } else {
    // Outside the active alarm window
    digitalWrite(ledPin, LOW);
    alarmMuted = false; // Reset mute for the next schedule slot
  }
}

void reportPillTaken(String slot) {
  if (WiFi.status() != WL_CONNECTED) return;

  String url = String(HOST_SERVER) + "/api/device/status";
  Serial.print("Reporting Pill Taken: ");
  Serial.println(url);

  http.begin(url);
  http.addHeader("Content-Type", "application/json");

  StaticJsonDocument<256> doc;
  doc["deviceId"] = DEVICE_ID;
  doc["slot"] = slot;
  doc["status"] = "taken";

  String jsonBody;
  serializeJson(doc, jsonBody);

  int httpCode = http.POST(jsonBody);

  if (httpCode == HTTP_CODE_OK || httpCode == HTTP_CODE_CREATED) {
    Serial.println("Server updated: Logged pill as taken.");
  } else {
    Serial.printf("Server update failed, error: %s\n", http.errorToString(httpCode).c_str());
  }
  http.end();
}
