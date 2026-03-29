const test = require("node:test");
const assert = require("node:assert/strict");

const { getUserNamesFromClaims, getUserNamesFromFullName } = require("./server");

test("splits a two-part full name into first and last name", () => {
  assert.deepEqual(getUserNamesFromFullName("John Doe", "john.doe@acme.com"), {
    firstName: "John",
    lastName: "Doe",
  });
});

test("uses the email dot split to determine the boundary for multi-part names", () => {
  assert.deepEqual(getUserNamesFromFullName("John Michael Doe", "john.doe@acme.com"), {
    firstName: "John Michael",
    lastName: "Doe",
  });
});

test("leaves the last name empty when a multi-part name cannot be split reliably", () => {
  assert.deepEqual(getUserNamesFromFullName("John Michael Doe", "john@acme.com"), {
    firstName: "John Michael Doe",
    lastName: "",
  });
});

test("falls back to the full name parsing when only the name claim is available", () => {
  assert.deepEqual(
    getUserNamesFromClaims({
      name: "Jane Maria Doe",
      email: "jane.doe@acme.com",
    }),
    {
      firstName: "Jane Maria",
      lastName: "Doe",
    },
  );
});
