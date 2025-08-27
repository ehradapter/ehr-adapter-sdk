/**
 * Patient Search Example using Mock Adapter
 *
 * Demonstrates various patient search capabilities
 */

import { MockAdapter } from "../../src/vendors/mock/MockAdapter";

async function patientSearchExample() {
  console.log("🔍 Patient Search Example\n");

  const mockAdapter = new MockAdapter({
    vendor: "mock",
    baseUrl: "http://localhost:3001",
    auth: { type: "apikey", apiKey: "mock-key" },
  });

  try {
    // Search by name
    console.log("📋 Searching by name...");
    const nameResults = await mockAdapter.searchPatients({ name: "John" });
    console.log(`✅ Found ${nameResults.length} patients named John`);

    // Search by birthdate
    console.log("\n📋 Searching by birthdate...");
    const birthdateResults = await mockAdapter.searchPatients({
      birthdate: "1990-01-01",
    });
    console.log(
      `✅ Found ${birthdateResults.length} patients born on 1990-01-01`
    );

    // Search by gender
    console.log("\n📋 Searching by gender...");
    const genderResults = await mockAdapter.searchPatients({
      gender: "female",
    });
    console.log(`✅ Found ${genderResults.length} female patients`);

    // Combined search
    console.log("\n📋 Combined search (name + gender)...");
    const combinedResults = await mockAdapter.searchPatients({
      name: "Smith",
      gender: "male",
    });
    console.log(
      `✅ Found ${combinedResults.length} male patients with surname Smith`
    );

    // Display detailed results
    if (combinedResults.length > 0) {
      console.log("\n📋 Detailed results:");
      combinedResults.forEach((patient, index) => {
        console.log(
          `   ${index + 1}. ${patient.name?.[0]?.given?.[0]} ${
            patient.name?.[0]?.family
          }`
        );
        console.log(`      ID: ${patient.id}`);
        console.log(`      DOB: ${patient.birthDate}`);
        console.log(`      Gender: ${patient.gender}`);
        if (patient.telecom) {
          const phone = patient.telecom.find((t) => t.system === "phone");
          const email = patient.telecom.find((t) => t.system === "email");
          if (phone) console.log(`      Phone: ${phone.value}`);
          if (email) console.log(`      Email: ${email.value}`);
        }
        console.log();
      });
    }
  } catch (error) {
    console.error("❌ Error during patient search:", error);
  }

  console.log("🎉 Patient search example completed!");
}

// Run the example
if (require.main === module) {
  patientSearchExample().catch(console.error);
}

export { patientSearchExample };
