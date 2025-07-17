import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { CheckCircle2, Circle, Trophy, Users, MapPin, Star } from 'lucide-react';

interface Team {
  id: number;
  name: string;
  abbreviation: string;
  city: string;
  sport: string;
  conference: string;
  division: string;
  primaryColor: string;
  isActive: boolean;
}

interface MultiSportTeamSelectorProps {
  onTeamSelect?: (teamId: number | null) => void;
  selectedTeam?: number | null;
  showPromotionCount?: boolean;
}

export default function MultiSportTeamSelector({ 
  onTeamSelect, 
  selectedTeam: externalSelectedTeam,
  showPromotionCount = false
}: MultiSportTeamSelectorProps) {
  const [internalSelectedTeam, setInternalSelectedTeam] = useState<number | null>(null);
  const [selectedSport, setSelectedSport] = useState<string>('ALL');

  const selectedTeam = externalSelectedTeam ?? internalSelectedTeam;

  const { data: allTeams = [], isLoading } = useQuery<Team[]>({
    queryKey: ['/api/teams'],
  });

  const { data: promotions = [] } = useQuery({
    queryKey: ['/api/promotions/active'],
    enabled: showPromotionCount,
  });

  // Get unique sports for tabs
  const sports = ['ALL', ...Array.from(new Set(allTeams.map(team => team.sport)))];
  
  // Filter teams by selected sport
  const filteredTeams = selectedSport === 'ALL' 
    ? allTeams 
    : allTeams.filter(team => team.sport === selectedSport);

  // Group teams by sport for "ALL" view
  const teamsBySport = allTeams.reduce((acc: Record<string, Team[]>, team) => {
    if (!acc[team.sport]) acc[team.sport] = [];
    acc[team.sport].push(team);
    return acc;
  }, {});

  // Get promotion count for a team
  const getPromotionCount = (teamId: number) => {
    return promotions.filter((promo: any) => promo.teamId === teamId).length;
  };

  const handleTeamSelect = (teamId: number) => {
    const newSelection = selectedTeam === teamId ? null : teamId;
    setInternalSelectedTeam(newSelection);
    onTeamSelect?.(newSelection);
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Trophy className="h-5 w-5" />
            Select Your Team
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-16 bg-gray-200 dark:bg-gray-700 rounded-lg" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  const renderTeamButton = (team: Team) => {
    const promotionCount = showPromotionCount ? getPromotionCount(team.id) : 0;
    
    return (
      <Button
        key={team.id}
        variant={selectedTeam === team.id ? "default" : "outline"}
        className="w-full h-16 flex items-center justify-between p-4 group hover:scale-[1.02] transition-all"
        onClick={() => handleTeamSelect(team.id)}
      >
        <div className="flex items-center space-x-3">
          <div 
            className="w-10 h-10 rounded-full border-2 border-white/20 flex items-center justify-center text-white font-bold text-sm shadow-lg" 
            style={{ backgroundColor: team.primaryColor || '#888' }}
          >
            {team.abbreviation}
          </div>
          <div className="text-left">
            <div className="font-semibold">{team.city} {team.name}</div>
            <div className="text-sm text-muted-foreground flex items-center gap-1">
              <MapPin className="h-3 w-3" />
              {team.conference} • {team.division}
            </div>
          </div>
        </div>
        <div className="flex items-center space-x-2">
          <Badge 
            variant="secondary" 
            className="group-hover:bg-primary group-hover:text-primary-foreground transition-colors"
            style={{ 
              backgroundColor: selectedTeam === team.id ? team.primaryColor : undefined,
              color: selectedTeam === team.id ? 'white' : undefined
            }}
          >
            {team.sport}
          </Badge>
          {showPromotionCount && promotionCount > 0 && (
            <Badge variant="destructive" className="text-xs">
              {promotionCount} deals
            </Badge>
          )}
          {selectedTeam === team.id ? (
            <CheckCircle2 className="h-5 w-5 text-green-500" />
          ) : (
            <Circle className="h-5 w-5 text-gray-400" />
          )}
        </div>
      </Button>
    );
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Trophy className="h-5 w-5" />
          Choose Your Team
          <Badge variant="outline" className="ml-auto">
            {allTeams.length} Teams Available
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs value={selectedSport} onValueChange={setSelectedSport} className="w-full">
          <TabsList className="grid w-full grid-cols-4 mb-4">
            {sports.map((sport) => (
              <TabsTrigger key={sport} value={sport} className="text-xs">
                {sport === 'ALL' ? (
                  <div className="flex items-center gap-1">
                    <Users className="h-3 w-3" />
                    All
                  </div>
                ) : (
                  sport
                )}
              </TabsTrigger>
            ))}
          </TabsList>

          <TabsContent value="ALL" className="space-y-4">
            {Object.entries(teamsBySport).map(([sport, teams]) => (
              <div key={sport}>
                <h3 className="font-semibold text-lg mb-3 flex items-center gap-2 border-b pb-2">
                  <Badge variant="outline">{sport}</Badge>
                  <span className="text-sm text-muted-foreground">
                    {teams.length} team{teams.length !== 1 ? 's' : ''}
                  </span>
                  {showPromotionCount && (
                    <Badge variant="secondary" className="ml-auto">
                      {teams.reduce((sum, team) => sum + getPromotionCount(team.id), 0)} active deals
                    </Badge>
                  )}
                </h3>
                <div className="space-y-2">
                  {teams.map(renderTeamButton)}
                </div>
              </div>
            ))}
          </TabsContent>

          {sports.filter(sport => sport !== 'ALL').map((sport) => (
            <TabsContent key={sport} value={sport} className="space-y-3">
              <div className="flex items-center justify-between mb-4">
                <Badge variant="outline" className="text-sm">
                  {sport} League
                </Badge>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">
                    {filteredTeams.length} team{filteredTeams.length !== 1 ? 's' : ''}
                  </span>
                  {showPromotionCount && (
                    <Badge variant="secondary">
                      {filteredTeams.reduce((sum, team) => sum + getPromotionCount(team.id), 0)} active deals
                    </Badge>
                  )}
                </div>
              </div>
              {filteredTeams.map(renderTeamButton)}
            </TabsContent>
          ))}
        </Tabs>

        {selectedTeam && (
          <div className="mt-6 p-4 bg-muted rounded-lg">
            <div className="flex items-center gap-3">
              <div 
                className="w-12 h-12 rounded-full border-2 border-white/20 flex items-center justify-center text-white font-bold shadow-lg" 
                style={{ backgroundColor: allTeams.find(t => t.id === selectedTeam)?.primaryColor }}
              >
                {allTeams.find(t => t.id === selectedTeam)?.abbreviation}
              </div>
              <div className="flex-1">
                <div className="font-semibold">You selected:</div>
                <div className="text-lg">
                  {allTeams.find(t => t.id === selectedTeam)?.city} {allTeams.find(t => t.id === selectedTeam)?.name}
                </div>
              </div>
              {showPromotionCount && (
                <div className="text-right">
                  <div className="text-sm text-muted-foreground">Active Deals</div>
                  <div className="text-2xl font-bold text-primary">
                    {getPromotionCount(selectedTeam)}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}