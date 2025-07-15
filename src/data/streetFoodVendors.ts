export interface Vendor {
    name: string;
    location: string;
    topSellingItem: string;
    costPerPerson: number; // in INR
    youtubeLink?: string; // Optional with timespan (e.g., "?t=120" for 2:00)
    contact?: string; // Optional phone number
    distanceFromRailway: number; // in km
    distanceFromAirport: number; // in km
    rating: number; // out of 5
    reviews: string[];
    carParking: boolean;
    googleLocation: string
  }
  
  export const streetFoodVendors: Record<string, Vendor[]> = {
    delhi: [
      {
        name: "Chandu Chaat Bhandar",
        location: "Chandni Chowk, Old Delhi",

        topSellingItem: "Aloo Chaat",
        costPerPerson: 50,
        youtubeLink: "https://www.youtube.com/watch?v=abc123?t=30",
        contact: "+91-9876543210",
        distanceFromRailway: 2.5,
        distanceFromAirport: 15,
        rating: 4.5,
        reviews: ["Amazing flavors!", "A bit crowded but worth it."],
        carParking: false,
        googleLocation: ""
      },
      {
        name: "Gupta Burger Center",
        location: "Paharganj",
        topSellingItem: "Desi Burger",
        costPerPerson: 40,
        distanceFromRailway: 0.8,
        distanceFromAirport: 14,
        rating: 4.2,
        reviews: ["Quick and tasty!", "Great for a budget snack."],
        carParking: false,
        googleLocation: ""
      },
    ],

    aligarh: [
        {
          name: "Moolchand",
          location: "Chandni Chowk, Old Delhi",
          topSellingItem: "Aloo Chaat",
          costPerPerson: 50,
          youtubeLink: "https://www.youtube.com/watch?v=abc123?t=30",
          contact: "+91-9876543210",
          distanceFromRailway: 2.5,
          distanceFromAirport: 15,
          rating: 4.0,
          reviews: ["Amazing kachoris at Moolchand and Sons", "A bit crowded but worth it."],
          carParking: false,
          googleLocation: ""
        },
        {
          name: "Gupta Burger Center",
          location: "Paharganj",
          topSellingItem: "Desi Burger",
          costPerPerson: 40,
          distanceFromRailway: 0.8,
          distanceFromAirport: 14,
          rating: 4.2,
          reviews: ["Quick and tasty!", "Great for a budget snack."],
          carParking: false,
          googleLocation: ""
        },
      ],
    mumbai: [
      {
        name: "Sharma Pav Bhaji",
        location: "Juhu Beach",
        topSellingItem: "Pav Bhaji",
        costPerPerson: 80,
        youtubeLink: "https://www.youtube.com/watch?v=xyz789?t=45",
        contact: "+91-9123456789",
        distanceFromRailway: 3,
        distanceFromAirport: 5,
        rating: 4.8,
        reviews: ["Best pav bhaji ever!", "Super fresh ingredients."],
        carParking: false,
        googleLocation: ""
      },
    ],
    // Add more cities as needed
  };
  
  // Simulated API function
  export const fetchVendorsByCity = async (city: string): Promise<Vendor[]> => {
    await new Promise((resolve) => setTimeout(resolve, 1000)); // Simulate delay
    return streetFoodVendors[city.toLowerCase()] || [];
  };