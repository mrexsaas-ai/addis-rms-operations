export const RESTAURANT_STATUSES = Object.freeze(["ACTIVE", "INACTIVE"]);

export function isRestaurantStatus(value) {
  return RESTAURANT_STATUSES.includes(value);
}

export function isActiveRestaurantStatus(value) {
  return value === "ACTIVE";
}

export function countRestaurantStatuses(restaurants) {
  return restaurants.reduce(
    (counts, restaurant) => {
      if (restaurant.status === "ACTIVE") counts.active += 1;
      if (restaurant.status === "INACTIVE") counts.inactive += 1;
      return counts;
    },
    { total: restaurants.length, active: 0, inactive: 0 },
  );
}