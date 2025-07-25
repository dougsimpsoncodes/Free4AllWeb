import mcdonaldsLogo from "@assets/arches-logo_108x108_1752686035547.jpg";
import pandaExpressLogo from "@assets/Untitled_1752689451866.jpg";
import delTacoLogo from "@assets/logo-dt-better-mex_1752689374355.png";
import ampmLogo from "@assets/ampm-logo.svg";
import jackInTheBoxLogo from "@assets/Untitled_1752690827741.png";

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
            src={mcdonaldsLogo} 
            alt="McDonald's logo"
            className={`${className} object-contain`}
          />
        );
      
      case "Panda Express":
        return (
          <img 
            src={pandaExpressLogo} 
            alt="Panda Express logo"
            className={`${className} object-contain`}
          />
        );
      
      case "Del Taco":
        return (
          <img 
            src={delTacoLogo} 
            alt="Del Taco logo"
            className={`${className} object-contain`}
          />
        );
      
      case "Jack in the Box":
        return (
          <img 
            src={jackInTheBoxLogo} 
            alt="Jack in the Box logo"
            className={`${className} object-contain`}
          />
        );
      
      case "ampm":
        return (
          <img 
            src={ampmLogo} 
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