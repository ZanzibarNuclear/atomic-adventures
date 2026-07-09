export const storyArcSeed = {
  "id": "story-main",
  "storyArcs": [
    {
      "id": "part-i-opener",
      "title": "Part I Opener",
      "defaultMode": "story",
      "startBeat": "survive-in-the-woods",
      "beats": [
        {
          "id": "survive-in-the-woods",
          "allowed": {
            "movement": {
              "mode": "unrestricted",
              "hexes": [
                "east-pines"
              ]
            },
            "storyForwardActions": [
              "move-hex:east-pines"
            ]
          },
          "completesWhen": {
            "location": {
              "place": "outdoors",
              "hex": "east-pines"
            }
          },
          "next": "keep-moving-west",
          "title": "Keep moving. Find something that can help you survive.",
          "scene": "intro"
        },
        {
          "id": "keep-moving-west",
          "allowed": {
            "movement": {
              "mode": "unrestricted",
              "hexes": [
                "center-pines"
              ]
            },
            "storyForwardActions": [
              "move-hex:center-pines"
            ]
          },
          "completesWhen": {
            "location": {
              "place": "outdoors",
              "hex": "center-pines"
            }
          },
          "next": "reach-the-gate",
          "title": "Keep moving. Stay across the slope.",
          "scene": "east-pines",
          "choices": [
            {
              "text": "Head uphill",
              "timeMinutes": 15,
              "activity": "moderate",
              "go_hex": "far-pines",
              "nextBeat": "far-pines"
            },
            {
              "text": "Continue west",
              "timeMinutes": 15,
              "activity": "moderate",
              "set_flags": [
                "story.east-pines"
              ],
              "go_hex": "center-pines"
            },
            {
              "text": "Head downhill",
              "timeMinutes": 15,
              "activity": "moderate",
              "go_hex": "lower-stand"
            }
          ]
        },
        {
          "id": "far-pines",
          "allowed": {
            "movement": {
              "mode": "unrestricted",
              "hexes": [
                "north-bend",
                "center-pines"
              ]
            },
            "storyForwardActions": [
              "move-hex:north-bend",
              "move-hex:center-pines"
            ]
          },
          "completesWhen": {
            "location": {
              "place": "outdoors",
              "hex": [
                "north-bend",
                "center-pines"
              ]
            }
          },
          "next": "reach-the-gate",
          "title": "Choose a way back across the slope.",
          "scene": "far-pines"
        },
        {
          "id": "reach-the-gate",
          "allowed": {
            "movement": {
              "mode": "unrestricted",
              "hexes": [
                "north-bend",
                "gate-woods",
                "south-pines",
                "utility-yard"
              ]
            },
            "storyForwardActions": [
              "move-hex:north-bend",
              "route:gate-woods",
              "move-hex:gate-woods",
              "move-hex:south-pines",
              "search:barrier",
              "passage:south-pines-hole",
              "move-hex:utility-yard"
            ],
            "itemActions": [
              "half-eaten-energy-bar.eat",
              "half-full-water-bottle.drink"
            ]
          },
          "completesWhen": {
            "location": {
              "place": "outdoors",
              "hex": [
                "gate-woods",
                "utility-yard"
              ]
            }
          },
          "title": "Follow the fence. Find where it leads.",
          "scene": "center-pines",
          "nextArc": "part-i-station"
        }
      ]
    },
    {
      "id": "part-i-station",
      "title": "Part I Station",
      "defaultMode": "story",
      "startBeat": "find-a-way-past-fence",
      "beats": [
        {
          "id": "find-a-way-past-fence",
          "allowed": {
            "movement": {
              "mode": "unrestricted",
              "hexes": [
                "south-pines",
                "west-slope",
                "utility-yard"
              ]
            },
            "storyForwardActions": [
              "passage-toggle:compound-gate",
              "passage:compound-gate",
              "search:barrier",
              "passage:south-pines-hole",
              "move-hex:west-slope",
              "route:utility-yard",
              "move-hex:utility-yard",
              "barrier:utility-yard"
            ],
            "outdoorActions": [
              "search:barrier",
              "passage-toggle:compound-gate",
              "passage:compound-gate",
              "passage:south-pines-hole"
            ],
            "itemActions": [
              "half-eaten-energy-bar.eat",
              "half-full-water-bottle.drink"
            ]
          },
          "completesWhen": {
            "location": {
              "place": "outdoors",
              "hex": "utility-yard"
            }
          },
          "next": "look-for-shelter",
          "title": "Catch your breath. Eat or drink if you need to, then find a way past the fence.",
          "scene": "the-gate"
        },
        {
          "id": "look-for-shelter",
          "allowed": {
            "movement": {
              "mode": "local-area",
              "exteriorNodes": [
                "garage-front-entrance",
                "large-bay-man-front",
                "south-east-corner-entrance"
              ],
              "transitions": [
                "garage-exit",
                "man-door-path",
                "southeast-corner"
              ]
            },
            "storyForwardActions": [
              "move-exterior:large-bay-man-front",
              "door-break:large-bay-man",
              "door-open:large-bay-man",
              "move-room:large-bay"
            ],
            "indoorActions": [
              "door-break:large-bay-man",
              "door-open:large-bay-man"
            ]
          },
          "completesWhen": {
            "location": {
              "place": "indoors",
              "room": "large-bay"
            }
          },
          "next": "solve-first-crisis",
          "title": "Look for shelter before you run out of light.",
          "scene": "large-bay-man-front"
        },
        {
          "id": "solve-first-crisis",
          "allowed": {
            "movement": {
              "mode": "local-area",
              "rooms": [
                "garage-stair",
                "conference",
                "kitchen",
                "library"
              ]
            },
            "storyForwardActions": [
              "door-open:conference-garage-stair",
              "door-open:conference-kitchen",
              "move-room:kitchen",
              "action:eat-rations",
              "action:purify-water",
              "door-open:library-hallway",
              "move-room:library",
              "action:rest-in-library"
            ],
            "indoorActions": [
              "door-open:conference-garage-stair",
              "door-open:conference-kitchen",
              "door-open:library-hallway",
              "eat-rations",
              "purify-water",
              "rest-in-library"
            ]
          },
          "completesWhen": {
            "flag": "day1.complete"
          },
          "next": "understand-building",
          "title": "Find food, water, and somewhere safe to rest.",
          "scene": "large-bay"
        },
        {
          "id": "understand-building",
          "allowed": {
            "movement": {
              "mode": "local-area",
              "rooms": [
                "control-room"
              ]
            },
            "storyForwardActions": [
              "move-room:control-room",
              "action:read-hydro-startup-card"
            ],
            "stageViews": [
              {
                "kind": "document",
                "id": "hydro-startup-instruction-card"
              }
            ],
            "indoorActions": [
              "read-hydro-startup-card"
            ],
            "itemActions": [
              "hydro-startup-instruction-card.read"
            ]
          },
          "completesWhen": {
            "flag": "hydro.startup_card_read"
          },
          "next": "inspect-intake",
          "title": "Figure out what this building was for.",
          "scene": "control-room"
        },
        {
          "id": "inspect-intake",
          "allowed": {
            "movement": {
              "mode": "local-area",
              "hexes": [
                "utility-yard"
              ],
              "exteriorNodes": [
                "upstream-bank",
                "intake-entrance"
              ]
            },
            "storyForwardActions": [
              "move-exterior:upstream-bank",
              "move-exterior:intake-entrance"
            ]
          },
          "completesWhen": {
            "location": {
              "place": "indoors",
              "exteriorNode": "upstream-bank"
            }
          },
          "next": "clear-open-intake",
          "title": "Trace the water path outside.",
          "scene": "intake-entrance"
        },
        {
          "id": "clear-open-intake",
          "allowed": {
            "movement": {
              "mode": "local-area"
            },
            "storyForwardActions": [
              "action:clear-intake-debris",
              "action:open-intake"
            ],
            "indoorActions": [
              "clear-intake-debris",
              "open-intake"
            ]
          },
          "completesWhen": {
            "facility": {
              "hydro.intakeOpen": true
            }
          },
          "next": "align-diversion-valve",
          "title": "Clear debris and open the intake.",
          "scene": "intake-entrance"
        },
        {
          "id": "align-diversion-valve",
          "allowed": {
            "movement": {
              "mode": "local-area"
            },
            "storyForwardActions": [
              "move-exterior:midstream-bank",
              "action:align-pipeflow"
            ],
            "indoorActions": [
              "align-pipeflow"
            ]
          },
          "completesWhen": {
            "facility": {
              "hydro.manualValves.upstreamOpen": true
            }
          },
          "next": "open-turbine-valve",
          "title": "Align the upstream diversion valve.",
          "scene": "midstream-bank"
        },
        {
          "id": "open-turbine-valve",
          "allowed": {
            "movement": {
              "mode": "local-area"
            },
            "storyForwardActions": [
              "move-exterior:downstream-bank",
              "action:open-turbine-valve"
            ],
            "indoorActions": [
              "open-turbine-valve"
            ]
          },
          "completesWhen": {
            "facility": {
              "hydro.manualValves.powerhouseOpen": true
            }
          },
          "next": "return-control-room",
          "title": "Open the powerhouse pipe valve.",
          "scene": "downstream-bank"
        },
        {
          "id": "return-control-room",
          "allowed": {
            "movement": {
              "mode": "local-area",
              "rooms": [
                "control-room"
              ]
            },
            "storyForwardActions": [
              "move-room:control-room"
            ]
          },
          "completesWhen": {
            "location": {
              "place": "indoors",
              "room": "control-room"
            }
          },
          "next": "connect-power",
          "title": "Return to the control room.",
          "scene": "control-room"
        },
        {
          "id": "connect-power",
          "allowed": {
            "movement": {
              "mode": "current-location-only"
            },
            "storyForwardActions": [
              "action:connect-power"
            ],
            "indoorActions": [
              "connect-power"
            ]
          },
          "completesWhen": {
            "facility": {
              "hydro.online": true
            }
          },
          "next": "check-console",
          "title": "Connect station power.",
          "scene": "control-room"
        },
        {
          "id": "check-console",
          "allowed": {
            "movement": {
              "mode": "current-location-only"
            },
            "storyForwardActions": [
              "hydro-console:open"
            ],
            "stageViews": [
              {
                "kind": "console",
                "id": "hydro"
              }
            ]
          },
          "onEnter": {
            "view": {
              "kind": "console",
              "id": "hydro",
              "focus": "generation"
            }
          },
          "completesWhen": {
            "facility": {
              "hydro.online": true
            }
          },
          "next": "complete-startup",
          "title": "Check the generator console.",
          "scene": "control-room"
        },
        {
          "id": "complete-startup",
          "allowed": {
            "movement": {
              "mode": "unrestricted"
            }
          },
          "completesWhen": {
            "facility": {
              "hydro.startupComplete": true
            }
          },
          "next": null,
          "title": "Bring the hydro generator online.",
          "scene": "control-room"
        }
      ]
    }
  ]
};
