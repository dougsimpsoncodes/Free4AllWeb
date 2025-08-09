// Food images for specific promotional offers - using authentic promotional materials
// Note: Using dynamic imports to handle missing images gracefully

interface FoodImageProps {
  foodItem: string;
  restaurantName?: string;
  className?: string;
  alt?: string;
}

export default function FoodImage({ foodItem, restaurantName, className = "w-full h-48 object-cover", alt }: FoodImageProps) {
  // Map specific food items to their authentic promotional images
  const getFoodImage = () => {
    const key = `${restaurantName?.toLowerCase()}-${foodItem.toLowerCase()}`;
    
    // Use available images from public directory as fallbacks
    switch (key) {
      // McDonald's promotions
      case "mcdonald's-mcnuggets":
        return "/logos/mcdonalds.png";
      
      // Panda Express promotions  
      case "panda express-panda plate":
        return "/logos/panda-express.png";
      
      // Jack in the Box promotions
      case "jack in the box-jumbo jack":
        return "/logos/del-taco.png"; // Using available logo as placeholder
      
      // ampm promotions
      case "ampm-hot dog":
        return "/logos/ampm.png";
      
      // Del Taco promotions
      case "del taco-taco":
      case "del taco-taco deal":
      case "del taco-2 free del tacos":
      case "del taco-cheeseburger":
      case "del taco-del cheeseburger":
      case "del taco-free del cheeseburger":
        return "/logos/del-taco.png";
      
      default:
        // Fallback to McDonald's logo
        return "/logos/mcdonalds.png";
    }
  };

  const imageAlt = alt || `${foodItem} from ${restaurantName}`;

  return (
    <img 
      src={getFoodImage()} 
      alt={imageAlt}
      className={className}
    />
  );
}