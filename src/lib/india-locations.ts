/**
 * State / city option lists used by the location dropdowns in lead and client
 * forms. Only India (and GIFT City) have curated lists; every other country
 * falls back to free-text entry through the combobox's "use custom value".
 */

export const INDIAN_STATES = [
  "Andaman and Nicobar Islands",
  "Andhra Pradesh",
  "Arunachal Pradesh",
  "Assam",
  "Bihar",
  "Chandigarh",
  "Chhattisgarh",
  "Dadra and Nagar Haveli and Daman and Diu",
  "Delhi",
  "Goa",
  "Gujarat",
  "Haryana",
  "Himachal Pradesh",
  "Jammu and Kashmir",
  "Jharkhand",
  "Karnataka",
  "Kerala",
  "Ladakh",
  "Lakshadweep",
  "Madhya Pradesh",
  "Maharashtra",
  "Manipur",
  "Meghalaya",
  "Mizoram",
  "Nagaland",
  "Odisha",
  "Puducherry",
  "Punjab",
  "Rajasthan",
  "Sikkim",
  "Tamil Nadu",
  "Telangana",
  "Tripura",
  "Uttar Pradesh",
  "Uttarakhand",
  "West Bengal",
];

export const INDIA_CITIES_BY_STATE: Record<string, string[]> = {
  "Andaman and Nicobar Islands": ["Port Blair"],
  "Andhra Pradesh": ["Visakhapatnam", "Vijayawada", "Guntur", "Nellore", "Tirupati", "Kakinada", "Rajahmundry"],
  "Arunachal Pradesh": ["Itanagar", "Naharlagun"],
  Assam: ["Guwahati", "Silchar", "Dibrugarh", "Jorhat", "Tezpur"],
  Bihar: ["Patna", "Gaya", "Muzaffarpur", "Bhagalpur", "Darbhanga"],
  Chandigarh: ["Chandigarh"],
  Chhattisgarh: ["Raipur", "Bhilai", "Bilaspur", "Korba"],
  "Dadra and Nagar Haveli and Daman and Diu": ["Silvassa", "Daman", "Diu"],
  Delhi: ["New Delhi", "Delhi", "Dwarka", "Rohini", "Saket"],
  Goa: ["Panaji", "Margao", "Vasco da Gama", "Mapusa"],
  Gujarat: ["Ahmedabad", "Gandhinagar", "GIFT City", "Surat", "Vadodara", "Rajkot", "Bhavnagar", "Jamnagar"],
  Haryana: ["Gurugram", "Faridabad", "Panipat", "Karnal", "Hisar", "Ambala"],
  "Himachal Pradesh": ["Shimla", "Dharamshala", "Solan", "Mandi"],
  "Jammu and Kashmir": ["Srinagar", "Jammu"],
  Jharkhand: ["Ranchi", "Jamshedpur", "Dhanbad", "Bokaro"],
  Karnataka: ["Bengaluru", "Mysuru", "Mangaluru", "Hubballi", "Belagavi", "Davanagere"],
  Kerala: ["Kochi", "Thiruvananthapuram", "Kozhikode", "Thrissur", "Kollam"],
  Ladakh: ["Leh", "Kargil"],
  Lakshadweep: ["Kavaratti"],
  "Madhya Pradesh": ["Bhopal", "Indore", "Jabalpur", "Gwalior", "Ujjain"],
  Maharashtra: ["Mumbai", "Navi Mumbai", "Thane", "Pune", "Nagpur", "Nashik", "Aurangabad", "Kolhapur"],
  Manipur: ["Imphal"],
  Meghalaya: ["Shillong"],
  Mizoram: ["Aizawl"],
  Nagaland: ["Kohima", "Dimapur"],
  Odisha: ["Bhubaneswar", "Cuttack", "Rourkela", "Puri"],
  Puducherry: ["Puducherry", "Karaikal"],
  Punjab: ["Ludhiana", "Amritsar", "Jalandhar", "Mohali", "Patiala"],
  Rajasthan: ["Jaipur", "Jodhpur", "Udaipur", "Kota", "Ajmer", "Bikaner"],
  Sikkim: ["Gangtok"],
  "Tamil Nadu": ["Chennai", "Coimbatore", "Madurai", "Tiruchirappalli", "Salem", "Tirunelveli"],
  Telangana: ["Hyderabad", "Secunderabad", "Warangal", "Nizamabad"],
  Tripura: ["Agartala"],
  "Uttar Pradesh": ["Lucknow", "Noida", "Ghaziabad", "Kanpur", "Varanasi", "Agra", "Prayagraj", "Meerut"],
  Uttarakhand: ["Dehradun", "Haridwar", "Rishikesh", "Haldwani"],
  "West Bengal": ["Kolkata", "Howrah", "Siliguri", "Durgapur", "Asansol"],
};

/** Major cities for non-Indian countries so the city dropdown is still useful. */
export const CITIES_BY_COUNTRY: Record<string, string[]> = {
  "GIFT City (India)": ["GIFT City"],
  "United States": ["New York", "Boston", "Chicago", "San Francisco", "Los Angeles", "Miami", "Dallas"],
  "United Kingdom": ["London", "Edinburgh", "Manchester", "Birmingham"],
  Singapore: ["Singapore"],
  "United Arab Emirates": ["Dubai", "Abu Dhabi", "Sharjah"],
  "Hong Kong": ["Hong Kong"],
  Mauritius: ["Port Louis", "Ebene"],
  Luxembourg: ["Luxembourg City"],
  Ireland: ["Dublin", "Cork"],
  Switzerland: ["Zurich", "Geneva", "Basel"],
  Japan: ["Tokyo", "Osaka"],
  Australia: ["Sydney", "Melbourne", "Brisbane", "Perth"],
  Canada: ["Toronto", "Vancouver", "Montreal", "Calgary"],
  Germany: ["Frankfurt", "Berlin", "Munich", "Hamburg"],
  France: ["Paris", "Lyon"],
  Netherlands: ["Amsterdam", "Rotterdam"],
  China: ["Shanghai", "Beijing", "Shenzhen"],
  Qatar: ["Doha"],
  "Saudi Arabia": ["Riyadh", "Jeddah"],
  "Cayman Islands": ["George Town"],
  Bahrain: ["Manama"],
};

const INDIA_COUNTRIES = new Set(["India", "GIFT City (India)"]);

export function stateOptions(country: string): string[] {
  return INDIA_COUNTRIES.has(country) ? INDIAN_STATES : [];
}

/**
 * All cities available for a country. When a state is selected (India), its
 * cities are listed first, followed by every other city in the country so the
 * user is never restricted by the state choice.
 */
export function cityOptions(country: string, state: string): string[] {
  if (INDIA_COUNTRIES.has(country)) {
    const all = Array.from(new Set(Object.values(INDIA_CITIES_BY_STATE).flat())).sort();
    const preferred = (state && INDIA_CITIES_BY_STATE[state]) || [];
    return [...preferred, ...all.filter((c) => !preferred.includes(c))];
  }
  return CITIES_BY_COUNTRY[country] ?? [];
}
