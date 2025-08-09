// Using logos from public directory to avoid import issues

interface RestaurantLogoProps {
  restaurantName: string;
  className?: string;
}

export default function RestaurantLogo({ restaurantName, className = "h-12 w-12" }: RestaurantLogoProps) {
  const getLogo = (name: string) => {
    switch (name) {
      case "McDonald's":
        return (
          <img 
            src="/logos/mcdonalds.png" 
            alt="McDonald's logo"
            className={`${className} object-contain`}
          />
        );
      
      case "Panda Express":
        return (
          <img 
            src="/logos/panda-express.png" 
            alt="Panda Express logo"
            className={`${className} object-contain`}
          />
        );
      
      case "Del Taco":
        return (
          <img 
            src="/logos/del-taco.png" 
            alt="Del Taco logo"
            className={`${className} object-contain`}
          />
        );
      
      case "Jack in the Box":
        return (
          <img 
            src="/logos/del-taco.png" 
            alt="Jack in the Box logo"
            className={`${className} object-contain`}
          />
        );
      
      case "ampm":
        return (
          <img 
            src="/logos/ampm.png" 
            alt="ampm logo"
            className={`${className} object-contain`}
          />
        );
      
      default:
        return (
          <svg viewBox="0 0 100 100" className={className}>
            <circle cx="50" cy="50" r="45" fill="#3b82f6" />
            <text x="50" y="55" textAnchor="middle" fill="white" fontSize="12" fontWeight="bold">LOGO</text>
          </svg>
        );
    }
  };

  return getLogo(restaurantName);
}