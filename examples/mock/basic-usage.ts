/**
 * Basic Mock Adapter Usage Example
 *
 * This example demonstrates the basic functionality of the Mock Adapter
 * for development and testing purposes.
 */

import { MockAdapter } from "../../src/vendors/mock/MockAdapter";

async function basicMockExample() {
  console.log("🏥 EHR Adapter SDK - Mock Adapter Example\n");

  // Initialize Mock Adapter
  const mockAdapter = new MockAdapter({
    vendor: "mock",
    baseUrl: "http://localhost:3001",
    auth: { type: "apikey", apiKey: "mock-key" },
    delay: 100, // Simulate network delay
    errorRate: 0, // No random errors for this example
    dataSet: "standard", // Use standard mock data set
  });

  try {
    // Example 1: Get a specific patient
    console.log("📋 Getting patient...");
    const patient = await mockAdapter.getPatient("patient-001");
    console.log(
      `✅ Patient: ${patient.name?.[0]?.given?.[0]} ${patient.name?.[0]?.family}`
    );
    console.log(`   DOB: ${patient.birthDate}`);
    console.log(`   Gender: ${patient.gender}`);
    console.log(`   ID: ${patient.id}\n`);

    // Example 2: Search for patients
    console.log('📋 Searching for patients named "Smith"...');
    const patients = await mockAdapter.searchPatients({ name: "Smith" });
    console.log(`✅ Found ${patients.length} patients:`);
    patients.forEach((p, index) => {
      console.log(
        `   ${index + 1}. ${p.name?.[0]?.given?.[0]} ${p.name?.[0]?.family} (${
          p.id
        })`
      );
    });
    console.log();

    // Example 3: Get vital signs
    console.log("📋 Getting vital signs for patient-001...");
    const vitals = await mockAdapter.getVitals("patient-001", {
      dateRange: {
        start: "2024-01-01",
        end: "2024-12-31",
      },
    });
    console.log(`✅ Found ${vitals.length} vital sign observations:`);
    vitals.forEach((vital, index) => {
      const code = vital.code.coding?.[0];
      const value = vital.valueQuantity || vital.component?.[0]?.valueQuantity;
      console.log(
        `   ${index + 1}. ${code?.display}: ${value?.value} ${value?.unit} (${
          vital.effectiveDateTime
        })`
      );
    });
    console.log();

    // Example 4: Get appointments
    console.log("📋 Getting appointments for patient-001...");
    const appointments = await mockAdapter.getAppointments("patient-001");
    console.log(`✅ Found ${appointments.length} appointments:`);
    appointments.forEach((apt, index) => {
      console.log(
        `   ${index + 1}. ${apt.description} - ${apt.start} (${apt.status})`
      );
    });
    console.log();

    // Example 5: Get medications
    console.log("📋 Getting medications for patient-001...");
    const medications = await mockAdapter.getMedications("patient-001");
    console.log(`✅ Found ${medications.length} medications:`);
    medications.forEach((med, index) => {
      const medication =
        med.medicationCodeableConcept?.text ||
        med.medicationCodeableConcept?.coding?.[0]?.display;
      console.log(`   ${index + 1}. ${medication} (${med.status})`);
    });
    console.log();
  } catch (error) {
    console.error("❌ Error with Mock Adapter:", error);
  }

  console.log("🎉 Mock adapter example completed!");
}

// Run the example
if (require.main === module) {
  basicMockExample().catch(console.error);
}

export { basicMockExample };
