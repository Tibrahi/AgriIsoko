export type AdminField = {
  name: string;
  label: string;
  type: "text" | "number" | "date" | "checkbox" | "select";
  required?: boolean;
  reference?: string;
  options?: readonly { value: string; label: string }[];
};

export type AdminEntity = {
  label: string;
  table: string;
  verification?: boolean;
  fields: readonly AdminField[];
};

const verificationOptions = [
  { value: "submitted", label: "Submitted" },
  { value: "verified", label: "Verified" },
  { value: "rejected", label: "Rejected" },
] as const;

export const adminEntities: Record<string, AdminEntity> = {
  crops: { label: "Crops", table: "crops", fields: [
    { name: "name", label: "Crop name", type: "text", required: true },
    { name: "active", label: "Active", type: "checkbox" },
  ] },
  geographies: { label: "Locations", table: "geographies", fields: [
    { name: "country_code", label: "Country code", type: "text", required: true },
    { name: "district_name", label: "District", type: "text", required: true },
    { name: "sector_name", label: "Sector", type: "text" },
    { name: "cell_name", label: "Cell", type: "text" },
    { name: "village_name", label: "Village", type: "text" },
  ] },
  organizations: { label: "Organizations", table: "organizations", fields: [
    { name: "name", label: "Organization name", type: "text", required: true },
    { name: "organization_type", label: "Type", type: "select", required: true, options: ["farmer", "cooperative", "buyer", "warehouse", "market", "government", "other"].map((value) => ({ value, label: value.replaceAll("_", " ") })) },
  ] },
  seasons: { label: "Seasons", table: "seasons", fields: [
    { name: "name", label: "Season name", type: "text", required: true },
    { name: "starts_on", label: "Starts on", type: "date", required: true },
    { name: "ends_on", label: "Ends on", type: "date", required: true },
  ] },
  farms: { label: "Farms", table: "farms", verification: true, fields: [
    { name: "organization_id", label: "Organization", type: "select", required: true, reference: "organizations" },
    { name: "geography_id", label: "Location", type: "select", required: true, reference: "geographies" },
    { name: "cultivated_area_ha", label: "Cultivated area (ha)", type: "number" },
    { name: "location_point", label: "Map point or coordinates (optional)", type: "text" },
    { name: "verification_status", label: "Review status", type: "select", options: verificationOptions },
  ] },
  harvest_reports: { label: "Harvest reports", table: "harvest_reports", verification: true, fields: [
    { name: "farm_id", label: "Farm (optional)", type: "select", reference: "farms" },
    { name: "organization_id", label: "Organization", type: "select", required: true, reference: "organizations" },
    { name: "crop_id", label: "Crop", type: "select", required: true, reference: "crops" },
    { name: "season_id", label: "Season", type: "select", reference: "seasons" },
    { name: "geography_id", label: "Location", type: "select", required: true, reference: "geographies" },
    { name: "report_type", label: "Report type", type: "select", required: true, options: ["intention", "progress", "actual"].map((value) => ({ value, label: value })) },
    { name: "quantity_kg", label: "Quantity (kg)", type: "number", required: true },
    { name: "report_date", label: "Report date", type: "date", required: true },
    { name: "expected_harvest_on", label: "Expected harvest (optional)", type: "date" },
    { name: "source", label: "Data source", type: "text", required: true },
    { name: "source_reference", label: "Source reference", type: "text" },
    { name: "notes", label: "Notes", type: "text" },
    { name: "verification_status", label: "Review status", type: "select", options: verificationOptions },
  ] },
  inventory_balances: { label: "Availability records", table: "inventory_balances", verification: true, fields: [
    { name: "organization_id", label: "Organization", type: "select", required: true, reference: "organizations" },
    { name: "crop_id", label: "Crop", type: "select", required: true, reference: "crops" },
    { name: "geography_id", label: "Location", type: "select", required: true, reference: "geographies" },
    { name: "quantity_kg", label: "Total quantity (kg)", type: "number", required: true },
    { name: "available_kg", label: "Available quantity (kg)", type: "number", required: true },
    { name: "as_of", label: "Recorded at", type: "date", required: true },
    { name: "source", label: "Data source", type: "text", required: true },
    { name: "verification_status", label: "Review status", type: "select", options: verificationOptions },
  ] },
  marketplace_listings: { label: "Marketplace listings", table: "marketplace_listings", verification: true, fields: [
    { name: "seller_organization_id", label: "Seller organization", type: "select", required: true, reference: "organizations" },
    { name: "crop_id", label: "Crop", type: "select", required: true, reference: "crops" },
    { name: "geography_id", label: "Location", type: "select", required: true, reference: "geographies" },
    { name: "available_quantity", label: "Quantity", type: "number", required: true },
    { name: "unit", label: "Unit", type: "text", required: true },
    { name: "price_per_unit", label: "Price per unit (optional)", type: "number" },
    { name: "currency", label: "Currency", type: "text", required: true },
    { name: "available_from", label: "Available from", type: "date" },
    { name: "status", label: "Listing status", type: "select", options: ["open", "reserved", "fulfilled", "withdrawn"].map((value) => ({ value, label: value.replaceAll("_", " ") })) },
    { name: "verification_status", label: "Review status", type: "select", options: verificationOptions },
    { name: "source", label: "Data source", type: "text", required: true },
  ] },
  marketplace_orders: { label: "Marketplace orders", table: "marketplace_orders", fields: [
    { name: "listing_id", label: "Listing", type: "select", required: true, reference: "marketplace_listings" },
    { name: "buyer_organization_id", label: "Buyer organization", type: "select", required: true, reference: "organizations" },
    { name: "quantity", label: "Quantity", type: "number", required: true },
    { name: "agreed_price_per_unit", label: "Agreed price (optional)", type: "number" },
    { name: "currency", label: "Currency", type: "text", required: true },
    { name: "status", label: "Order status", type: "select", required: true, options: ["requested", "accepted", "rejected", "in_delivery", "completed", "cancelled"].map((value) => ({ value, label: value.replaceAll("_", " ") })) },
  ] },
};
