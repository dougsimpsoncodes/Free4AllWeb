// Food images for specific promotional offers - using authentic promotional materials
import jumboJackPromoImage from "@assets/jackinthebox-dodgers-deal_1752690195103.png";
import ampmHotdogPromoImage from "@assets/ampm-dodgers-promo_1752690208698.jpg";
import mcdonaldsNuggetsPromoImage from "@assets/mcdonalds-dodgers-deal_1752690222163.png";
import pandaExpressPromoImage from "@assets/panda-express-promo_1752690233859.png";

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
    
    switch (key) {
      // McDonald's promotions
      case "mcdonald's-mcnuggets":
        return mcdonaldsNuggetsPromoImage;
      
      // Panda Express promotions  
      case "panda express-panda plate":
        return pandaExpressPromoImage;
      
      // Jack in the Box promotions
      case "jack in the box-jumbo jack":
        return jumboJackPromoImage;
      
      // ampm promotions
      case "ampm-hot dog":
        return ampmHotdogPromoImage;
      
      // Del Taco promotions (fallback to one of our authentic images)
      case "del taco-taco":
      case "del taco-taco deal":
      case "del taco-2 free del tacos":
      case "del taco-cheeseburger":
      case "del taco-del cheeseburger":
      case "del taco-free del cheeseburger":
        return pandaExpressPromoImage; // Using authentic promo as fallback
      
      default:
        // Fallback to one of our authentic promotional images
        return mcdonaldsNuggetsPromoImage;
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