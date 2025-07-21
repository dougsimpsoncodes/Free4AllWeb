import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, Clock } from "lucide-react";
import type { Team } from "@/types/api";

export default function TeamSelector() {
  const { data: teams = [] } = useQuery<Team[]>({
    queryKey: ["/api/teams"],
    retry: false,
  });

  const activeTeam = teams.find((team) => team.id === 1); // Dodgers
  const comingTeams = [
    { name: "LA Angels", abbreviation: "LAA", sport: "MLB", color: "#d32f2f" },
    { name: "LA Lakers", abbreviation: "LAL", sport: "NBA", color: "#552583" },
    { name: "LA Rams", abbreviation: "LAR", sport: "NFL", color: "#003594" },
    { name: "USC Trojans", abbreviation: "USC", sport: "College Football", color: "#990000" },
  ];

  return (
    <div>
      <div className="text-center mb-12">
        <h2 className="text-3xl font-bold text-gray-900 mb-4">Multi-Team Support</h2>
        <p className="text-gray-600 max-w-2xl mx-auto">
          Our platform is designed to scale across all major sports leagues. Start with the Dodgers and expand to your favorite teams!
        </p>
      </div>

      {/* Current Team (Dodgers) */}
      {activeTeam && (
        <Card className="mb-8">
          <CardContent className="p-8">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center space-x-4">
                <div 
                  className="w-16 h-16 rounded-lg flex items-center justify-center text-white font-bold text-lg"
                  style={{ backgroundColor: activeTeam.primaryColor || '#1e40af' }}
                >
                  {activeTeam.abbreviation}
                </div>
                <div>
                  <h3 className="text-xl font-bold text-gray-900">{activeTeam.name}</h3>
                  <p className="text-gray-600">MLB • Currently Active</p>
                </div>
              </div>
              <Badge className="bg-success-green text-white">
                <CheckCircle className="h-4 w-4 mr-2" />
                Tracking
              </Badge>
            </div>
            
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-gray-900">5</div>
                <div className="text-sm text-gray-600">Partner Restaurants</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-gray-900">47</div>
                <div className="text-sm text-gray-600">Games Tracked</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-gray-900">123</div>
                <div className="text-sm text-gray-600">Deals Triggered</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-gray-900">1,847</div>
                <div className="text-sm text-gray-600">Alert Subscribers</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-gray-900">$31K</div>
                <div className="text-sm text-gray-600">Total Savings</div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Coming Soon Teams */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {comingTeams.map((team) => (
          <Card key={team.abbreviation} className="text-center opacity-75">
            <CardContent className="p-6">
              <div 
                className="w-12 h-12 rounded-lg flex items-center justify-center mx-auto mb-4 text-white font-bold"
                style={{ backgroundColor: team.color }}
              >
                {team.abbreviation}
              </div>
              <h4 className="font-bold text-gray-900 mb-2">{team.name}</h4>
              <p className="text-sm text-gray-600 mb-4">{team.sport}</p>
              <Badge variant="secondary" className="bg-gray-100 text-gray-600">
                <Clock className="h-3 w-3 mr-1" />
                Coming Soon
              </Badge>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
