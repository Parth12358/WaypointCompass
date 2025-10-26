/*
 * SenseCAP Indicator RP2040 - Accelerometer Only
 * Streams to Serial Monitor AND ESP32
 */

#include <PacketSerial.h>
#include <Wire.h>

// MMA7660FC Accelerometer
#define ACCEL_ADDR 0x4C
#define REG_XOUT 0x00
#define REG_YOUT 0x01
#define REG_ZOUT 0x02
#define REG_MODE 0x07
#define REG_SR   0x08

// I2C Pins
#define GROVE_SDA 20
#define GROVE_SCL 21
#define I2C_PWR_CTRL 18

// UART to ESP32
#define UART_TX 16
#define UART_RX 17

// Buzzer
#define BUZZER_PIN 19

PacketSerial rp2040Serial;

// Data structure for ESP32
struct AccelData {
  uint8_t type;        // 0xAA
  float x;
  float y;
  float z;
  float magnitude;
  uint32_t timestamp;
};

void writeAccelRegister(uint8_t reg, uint8_t value) {
  Wire.beginTransmission(ACCEL_ADDR);
  Wire.write(reg);
  Wire.write(value);
  Wire.endTransmission();
}

int8_t readAccelRegister(uint8_t reg) {
  Wire.beginTransmission(ACCEL_ADDR);
  Wire.write(reg);
  Wire.endTransmission(false);
  
  Wire.requestFrom((uint8_t)ACCEL_ADDR, (uint8_t)1);
  if (Wire.available()) {
    uint8_t value = Wire.read();
    if (value & 0x40) return 0; // Invalid
    if (value & 0x20) value |= 0xC0; // Sign extend
    return (int8_t)value;
  }
  return 0;
}

float rawToG(int8_t raw) {
  return (float)raw / 21.0;
}

void buzzer_tone(int frequency_hz, int duration_ms) {
  tone(BUZZER_PIN, frequency_hz, duration_ms);
  delay(duration_ms);
  noTone(BUZZER_PIN);
}

void setup() {
  // Serial for debugging
  Serial.begin(115200);
  delay(2000);
  Serial.println("\n=== RP2040 Accelerometer Stream ===");
  
  // Buzzer
  pinMode(BUZZER_PIN, OUTPUT);
  digitalWrite(BUZZER_PIN, LOW);
  buzzer_tone(1000, 100);
  
  // UART to ESP32
  Serial1.setRX(UART_RX);
  Serial1.setTX(UART_TX);
  Serial1.begin(115200);
  rp2040Serial.setStream(&Serial1);
  rp2040Serial.setPacketHandler(&onPacketReceived);
  
  // Power on I2C
  pinMode(I2C_PWR_CTRL, OUTPUT);
  digitalWrite(I2C_PWR_CTRL, HIGH);
  delay(200);
  
  // Initialize I2C
  Wire.setSDA(GROVE_SDA);
  Wire.setSCL(GROVE_SCL);
  Wire.begin();
  Wire.setClock(100000);
  
  Serial.println("I2C initialized");
  
  // Initialize Accelerometer
  Serial.print("Initializing MMA7660FC... ");
  writeAccelRegister(REG_MODE, 0x00); // Standby
  delay(50);
  writeAccelRegister(REG_SR, 0x07);   // 64 Hz
  delay(50);
  writeAccelRegister(REG_MODE, 0x01); // Active
  delay(50);
  
  Wire.beginTransmission(ACCEL_ADDR);
  if (Wire.endTransmission() == 0) {
    Serial.println("OK!");
    buzzer_tone(1500, 200);
  } else {
    Serial.println("ERROR - NOT FOUND!");
    while(1) {
      buzzer_tone(500, 200);
      delay(500);
    }
  }
  
  Serial.println("\nStreaming to Serial AND ESP32...\n");
  delay(1000);
}

void loop() {
  rp2040Serial.update();
  
  // Read accelerometer
  int8_t xRaw = readAccelRegister(REG_XOUT);
  int8_t yRaw = readAccelRegister(REG_YOUT);
  int8_t zRaw = readAccelRegister(REG_ZOUT);
  
  float x = rawToG(xRaw);
  float y = rawToG(yRaw);
  float z = rawToG(zRaw);
  float mag = sqrt(x*x + y*y + z*z);
  
  // Prepare data for ESP32
  AccelData data;
  data.type = 0xAA;
  data.x = x;
  data.y = y;
  data.z = z;
  data.magnitude = mag;
  data.timestamp = millis();
  
  // Send to ESP32 via UART
  rp2040Serial.send((uint8_t*)&data, sizeof(data));
  
  // Print to Serial Monitor
  Serial.println("========================================");
  Serial.print("Time: "); Serial.print(data.timestamp); Serial.println(" ms");
  Serial.println("\n--- ACCELEROMETER ---");
  Serial.print("  X: "); Serial.print(x, 3); Serial.println(" g");
  Serial.print("  Y: "); Serial.print(y, 3); Serial.println(" g");
  Serial.print("  Z: "); Serial.print(z, 3); Serial.println(" g");
  Serial.print("  Magnitude: "); Serial.print(mag, 3); Serial.println(" g");
  Serial.println("========================================\n");
  
  delay(100); // 10 Hz update rate
}

void onPacketReceived(const uint8_t* buffer, size_t size) {
  Serial.print("Received from ESP32: ");
  Serial.print(size);
  Serial.println(" bytes");
}
