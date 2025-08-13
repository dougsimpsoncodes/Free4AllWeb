#!/bin/bash

# Test the enhanced deal approval workflow
curl -X POST "http://localhost:5001/api/admin/deals/408/approve" \
  -H "Content-Type: application/json" \
  -H "Cookie: __session=eyJhbGciOiJSUzI1NiIsImNhdCI6ImNsX0I3ZDRQRDExMUFBQSIsImtpZCI6Imluc18zMTQ5UzZJaDBmdGpnSzFtZTRrOXNTbXdsengiLCJ0eXAiOiJKV1QifQ.eyJhenAiOiJodHRwOi8vbG9jYWxob3N0OjUwMDEiLCJleHAiOjE3NTUxMDY4OTksImZ2YSI6WzUyNTYsLTFdLCJpYXQiOjE3NTUxMDY4MzksImlzcyI6Imh0dHBzOi8vaW1tdW5lLWJlYXItMzkuY2xlcmsuYWNjb3VudHMuZGV2IiwibmJmIjoxNzU1MTA2ODI5LCJzaWQiOiJzZXNzXzMxNGx4a1g0M3JiSllmdFFNMExhSTc2amNvOCIsInN1YiI6InVzZXJfMzE0bHhlWTQyS3g4UFJ4YlRwSE1JNzdpUXVpIiwidiI6Mn0.Ml8jSNUu4K0zq_S26GI8g1G7bqXssSoX5lw-rTyZuNKFkw5wgLf3ituUgq570X7jx_DDkbLDugq_heYYwQwC9x1AyZy9L0_dl-Hbkuxb0RxPzMhD_Cn66zvF02MslBkoklwyH0dC2jqMO7NKTCC7osfys2PPPOVzeXAIMXq1RXIQttHQzFqvhCS_h_SZL3BqVmMN29PoAHit8R3FJJSdPT4VQfORNg93aXzFKgT30qg59yy-n2GNn6YIsOvHBMI6vbQRxzlvFfMQxIDQDWEUyGPkpAGYG0mAkg1SpU0uo-CNHMnR8V_n7UODojFxvglYGKfV2BDoSxY2JgDRFV0Rfw" \
  -d '{
    "dealDetails": {
      "title": "Free Orange Chicken When Dodgers Win",
      "description": "Get free Orange Chicken at Panda Express when the Los Angeles Dodgers win their game",
      "restaurant": "Panda Express",
      "team": "Los Angeles Dodgers",
      "triggerType": "team_win",
      "triggerCondition": "Dodgers win any game",
      "triggerConditions": [
        {
          "field": "result",
          "operator": "equals",
          "value": "win"
        }
      ],
      "triggerLogic": "AND",
      "offerValue": "Free",
      "promoCode": null,
      "instructions": "Show this notification to cashier when Dodgers win",
      "expirationHours": 24,
      "locations": ["all"],
      "perUserLimit": 1,
      "totalLimit": null,
      "perDayLimit": 1
    },
    "sourceUrl": "https://reddit.com/r/dodgers/panda_express_deal"
  }' | jq .