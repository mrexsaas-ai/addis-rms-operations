import test from "node:test";
import assert from "node:assert/strict";
import {
  countRestaurantStatuses,
  isActiveRestaurantStatus,
  isRestaurantStatus,
} from "./restaurant-lifecycle.mjs";

test("only ACTIVE and INACTIVE are valid restaurant lifecycle states", () => {
  assert.equal(isRestaurantStatus("ACTIVE"), true);
  assert.equal(isRestaurantStatus("INACTIVE"), true);
  assert.equal(isRestaurantStatus("EXPIRED"), false);
  assert.equal(isRestaurantStatus("active"), false);
  assert.equal(isRestaurantStatus(null), false);
});

test("only ACTIVE restaurants pass the tenant lifecycle gate", () => {
  for (const role of ["ADMIN", "OWNER", "MANAGER", "SERVER", "CHEF", "BARMAN"]) {
    assert.equal(isActiveRestaurantStatus("ACTIVE"), true, `${role} active access`);
    assert.equal(isActiveRestaurantStatus("INACTIVE"), false, `${role} inactive access`);
  }
});

test("platform summary counts active and inactive restaurants separately", () => {
  assert.deepEqual(
    countRestaurantStatuses([
      { status: "ACTIVE" },
      { status: "INACTIVE" },
      { status: "ACTIVE" },
    ]),
    { total: 3, active: 2, inactive: 1 },
  );
});
