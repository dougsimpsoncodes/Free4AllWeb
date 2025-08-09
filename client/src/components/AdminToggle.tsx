import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Settings, BarChart3, Database, ChevronDown, Bell } from "lucide-react";

export default function AdminToggle() {
  const [isOpen, setIsOpen] = useState(false);

  // SIMPLIFIED - ONLY 4 CORE ADMIN SECTIONS
  const adminLinks = [
    {
      href: "/home",
      label: "User Home",
      icon: Settings,
      description: "Main user dashboard"
    },
    {
      href: "/admin",
      label: "Admin Dashboard", 
      icon: Database,
      description: "Core admin controls"
    },
    {
      href: "/admin/analytics",
      label: "User Analytics",
      icon: BarChart3,
      description: "User data & system health"
    },
    {
      href: "/notifications",
      label: "Notifications",
      icon: Bell,
      description: "Manage alert preferences"
    }
  ];

  return (
    <div className="fixed top-20 right-4 z-40">
      <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className="gap-2 shadow-lg bg-white hover:bg-gray-50"
          >
            <Settings className="h-4 w-4" />
            Admin
            <ChevronDown className="h-3 w-3" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          {adminLinks.map((link) => {
            const Icon = link.icon;
            return (
              <DropdownMenuItem key={link.href} asChild>
                <a
                  href={link.href}
                  className="flex items-center gap-3 px-3 py-2 cursor-pointer"
                >
                  <Icon className="h-4 w-4 text-gray-500" />
                  <div className="flex flex-col">
                    <span className="font-medium">{link.label}</span>
                    <span className="text-xs text-gray-500">{link.description}</span>
                  </div>
                </a>
              </DropdownMenuItem>
            );
          })}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}