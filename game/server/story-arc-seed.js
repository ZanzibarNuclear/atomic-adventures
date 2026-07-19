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
          "title": "Keep moving. Find something that can help you survive.",
          "scene": "intro",
          "choices": [],
          "allowed": {
            "movement": {
              "mode": "unrestricted",
              "hexes": [
                "east-pines"
              ],
              "rooms": [],
              "exteriorNodes": [],
              "transitions": []
            },
            "storyForwardActions": [
              "move-hex:east-pines"
            ],
            "optionalActions": [],
            "storyChoices": [],
            "stageViews": [],
            "indoorActions": [],
            "outdoorActions": [],
            "itemActions": [],
            "developerActions": []
          },
          "completesWhen": {
            "location": {
              "place": "outdoors",
              "hex": "east-pines"
            }
          },
          "onEnter": null,
          "onComplete": null,
          "next": "keep-moving-west"
        },
        {
          "id": "keep-moving-west",
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
          ],
          "allowed": {
            "movement": {
              "mode": "unrestricted",
              "hexes": [
                "center-pines"
              ],
              "rooms": [],
              "exteriorNodes": [],
              "transitions": []
            },
            "storyForwardActions": [
              "move-hex:center-pines"
            ],
            "optionalActions": [],
            "storyChoices": [],
            "stageViews": [],
            "indoorActions": [],
            "outdoorActions": [],
            "itemActions": [],
            "developerActions": []
          },
          "completesWhen": {
            "location": {
              "place": "outdoors",
              "hex": "center-pines"
            }
          },
          "onEnter": null,
          "onComplete": null,
          "next": "reach-the-gate"
        },
        {
          "id": "far-pines",
          "title": "Choose a way back across the slope.",
          "scene": "far-pines",
          "choices": [],
          "allowed": {
            "movement": {
              "mode": "unrestricted",
              "hexes": [
                "north-bend",
                "center-pines"
              ],
              "rooms": [],
              "exteriorNodes": [],
              "transitions": []
            },
            "storyForwardActions": [
              "move-hex:north-bend",
              "move-hex:center-pines"
            ],
            "optionalActions": [],
            "storyChoices": [],
            "stageViews": [],
            "indoorActions": [],
            "outdoorActions": [],
            "itemActions": [],
            "developerActions": []
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
          "onEnter": null,
          "onComplete": null,
          "next": "reach-the-gate"
        },
        {
          "id": "reach-the-gate",
          "title": "Follow the fence. Find where it leads.",
          "scene": "center-pines",
          "choices": [],
          "allowed": {
            "movement": {
              "mode": "unrestricted",
              "hexes": [
                "north-bend",
                "gate-woods",
                "south-pines",
                "utility-yard"
              ],
              "rooms": [],
              "exteriorNodes": [],
              "transitions": []
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
            "optionalActions": [],
            "storyChoices": [],
            "stageViews": [],
            "indoorActions": [],
            "outdoorActions": [],
            "itemActions": [
              "half-eaten-energy-bar.eat",
              "half-full-water-bottle.drink"
            ],
            "developerActions": []
          },
          "completesWhen": {
            "location": {
              "place": "outdoors",
              "hex": "gate-woods"
            }
          },
          "onEnter": null,
          "onComplete": null,
          "next": "find-a-way-past-fence"
        },
        {
          "id": "find-a-way-past-fence",
          "title": "Catch your breath. Eat or drink if you need to, then find a way past the fence.",
          "scene": "the-gate",
          "choices": [],
          "allowed": {
            "movement": {
              "mode": "unrestricted",
              "hexes": [
                "south-pines",
                "west-slope",
                "utility-yard"
              ],
              "rooms": [],
              "exteriorNodes": [],
              "transitions": []
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
            "optionalActions": [],
            "storyChoices": [],
            "stageViews": [],
            "indoorActions": [],
            "outdoorActions": [
              "search:barrier",
              "passage-toggle:compound-gate",
              "passage:compound-gate",
              "passage:south-pines-hole"
            ],
            "itemActions": [
              "half-eaten-energy-bar.eat",
              "half-full-water-bottle.drink"
            ],
            "developerActions": []
          },
          "completesWhen": {
            "flag": "compound.gate-passed"
          },
          "onEnter": null,
          "onComplete": null,
          "next": null
        }
      ],
      "completion": {
        "nextArc": "part-i-station",
        "card": {
          "eyebrow": "Inside the fence",
          "heading": "A way through",
          "description": "The gate yields. Beyond it, a road and the sound of water — shelter has to be close.",
          "actionLabel": "Continue"
        }
      }
    },
    {
      "id": "part-i-fence-hole",
      "title": "Through the Fence",
      "defaultMode": "story",
      "startBeat": "approach-side-entrance",
      "beats": [
        {
          "id": "approach-side-entrance",
          "title": "You're past the fence. Find shelter before dark.",
          "scene": "side-entrance",
          "choices": [],
          "allowed": {
            "movement": {
              "mode": "local-area",
              "hexes": [
                "utility-yard",
                "west-slope",
                "south-pines"
              ],
              "rooms": [],
              "exteriorNodes": [
                "large-bay-man-front",
                "garage-front-entrance",
                "south-east-corner-entrance"
              ],
              "transitions": [
                "garage-exit",
                "man-door-path",
                "southeast-corner"
              ]
            },
            "storyForwardActions": [
              "move-hex:utility-yard",
              "move-exterior:large-bay-man-front",
              "door-break:large-bay-man",
              "door-open:large-bay-man",
              "move-room:large-bay"
            ],
            "optionalActions": [],
            "storyChoices": [],
            "stageViews": [],
            "indoorActions": [
              "door-break:large-bay-man",
              "door-open:large-bay-man"
            ],
            "outdoorActions": [],
            "itemActions": [
              "half-eaten-energy-bar.eat",
              "half-full-water-bottle.drink"
            ],
            "developerActions": []
          },
          "completesWhen": {
            "location": {
              "place": "indoors",
              "room": "large-bay"
            }
          },
          "onEnter": null,
          "onComplete": null,
          "next": null
        }
      ],
      "completion": {
        "nextArc": "part-i-station",
        "nextBeat": "solve-first-crisis",
        "card": {
          "eyebrow": "Inside",
          "heading": "A side door",
          "description": "The man door gives way. Better cover than the trees.",
          "actionLabel": "Continue"
        }
      }
    },
    {
      "id": "part-i-station",
      "title": "Part I Station",
      "defaultMode": "story",
      "startBeat": "look-for-shelter",
      "beats": [
        {
          "id": "look-for-shelter",
          "title": "Look for shelter before you run out of light.",
          "scene": "large-bay-man-front",
          "choices": [],
          "allowed": {
            "movement": {
              "mode": "local-area",
              "hexes": [],
              "rooms": [],
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
            "optionalActions": [],
            "storyChoices": [],
            "stageViews": [],
            "indoorActions": [
              "door-break:large-bay-man",
              "door-open:large-bay-man"
            ],
            "outdoorActions": [],
            "itemActions": [],
            "developerActions": []
          },
          "completesWhen": {
            "location": {
              "place": "indoors",
              "room": "large-bay"
            }
          },
          "onEnter": null,
          "onComplete": null,
          "next": "solve-first-crisis"
        },
        {
          "id": "solve-first-crisis",
          "title": "Find food, water, and somewhere safe to rest.",
          "scene": "large-bay",
          "choices": [],
          "allowed": {
            "movement": {
              "mode": "local-area",
              "hexes": [],
              "rooms": [
                "garage-stair",
                "conference",
                "kitchen",
                "library"
              ],
              "exteriorNodes": [],
              "transitions": []
            },
            "storyForwardActions": [
              "door-open:library-hallway",
              "door-open:conference-kitchen",
              "door-open:conference-garage-stair",
              "move-room:kitchen",
              "action:eat-rations",
              "action:purify-water",
              "move-room:library",
              "action:rest-in-library"
            ],
            "optionalActions": [],
            "storyChoices": [],
            "stageViews": [],
            "indoorActions": [
              "door-open:library-hallway",
              "door-open:conference-kitchen",
              "door-open:conference-garage-stair",
              "eat-rations",
              "purify-water",
              "rest-in-library"
            ],
            "outdoorActions": [],
            "itemActions": [],
            "developerActions": []
          },
          "completesWhen": {
            "flag": "library.sleep-1"
          },
          "onEnter": null,
          "onComplete": null,
          "next": null
        }
      ],
      "completion": {
        "nextArc": "understand-building",
        "card": {
          "eyebrow": "Morning",
          "heading": "Food and rest",
          "description": "A full stomach and a night under a roof. Daylight will make the building easier to read.",
          "actionLabel": "Continue"
        }
      }
    },
    {
      "id": "understand-building",
      "title": "Understand the building",
      "defaultMode": "story",
      "startBeat": "understand-building",
      "beats": [
        {
          "id": "understand-building",
          "title": "Figure out what this building was for.",
          "scene": "control-room",
          "choices": [],
          "allowed": {
            "movement": {
              "mode": "local-area",
              "hexes": [],
              "rooms": [
                "control-room"
              ],
              "exteriorNodes": [],
              "transitions": []
            },
            "storyForwardActions": [
              "move-room:control-room",
              "action:read-hydro-startup-card"
            ],
            "optionalActions": [],
            "storyChoices": [],
            "stageViews": [
              {
                "kind": "document",
                "id": "hydro-startup-instruction-card"
              }
            ],
            "indoorActions": [
              "read-hydro-startup-card"
            ],
            "outdoorActions": [],
            "itemActions": [
              "hydro-startup-instruction-card.read"
            ],
            "developerActions": []
          },
          "completesWhen": {
            "flag": "hydro.startup_card_read"
          },
          "onEnter": null,
          "onComplete": null,
          "next": "inspect-intake"
        },
        {
          "id": "inspect-intake",
          "title": "Trace the water path outside.",
          "scene": "intake-entrance",
          "choices": [],
          "allowed": {
            "movement": {
              "mode": "local-area",
              "hexes": [
                "utility-yard"
              ],
              "rooms": [],
              "exteriorNodes": [
                "upstream-bank",
                "intake-entrance"
              ],
              "transitions": []
            },
            "storyForwardActions": [
              "move-exterior:upstream-bank",
              "move-exterior:intake-entrance"
            ],
            "optionalActions": [],
            "storyChoices": [],
            "stageViews": [],
            "indoorActions": [],
            "outdoorActions": [],
            "itemActions": [],
            "developerActions": []
          },
          "completesWhen": {
            "location": {
              "place": "indoors",
              "exteriorNode": "upstream-bank"
            }
          },
          "onEnter": null,
          "onComplete": null,
          "next": "clear-open-intake"
        },
        {
          "id": "clear-open-intake",
          "title": "Clear debris and open the intake.",
          "scene": "intake-entrance",
          "choices": [],
          "allowed": {
            "movement": {
              "mode": "local-area",
              "hexes": [],
              "rooms": [],
              "exteriorNodes": [],
              "transitions": []
            },
            "storyForwardActions": [
              "action:clear-intake-debris",
              "action:open-intake"
            ],
            "optionalActions": [],
            "storyChoices": [],
            "stageViews": [],
            "indoorActions": [
              "clear-intake-debris",
              "open-intake"
            ],
            "outdoorActions": [],
            "itemActions": [],
            "developerActions": []
          },
          "completesWhen": {
            "facility": {
              "hydro.intakeOpen": true
            }
          },
          "onEnter": null,
          "onComplete": null,
          "next": "align-diversion-valve"
        },
        {
          "id": "align-diversion-valve",
          "title": "Align the upstream diversion valve.",
          "scene": "midstream-bank",
          "choices": [],
          "allowed": {
            "movement": {
              "mode": "local-area",
              "hexes": [],
              "rooms": [],
              "exteriorNodes": [],
              "transitions": []
            },
            "storyForwardActions": [
              "move-exterior:midstream-bank",
              "action:align-pipeflow"
            ],
            "optionalActions": [],
            "storyChoices": [],
            "stageViews": [],
            "indoorActions": [
              "align-pipeflow"
            ],
            "outdoorActions": [],
            "itemActions": [],
            "developerActions": []
          },
          "completesWhen": {
            "facility": {
              "hydro.manualValves.upstreamOpen": true
            }
          },
          "onEnter": null,
          "onComplete": null,
          "next": "open-turbine-valve"
        },
        {
          "id": "open-turbine-valve",
          "title": "Open the powerhouse pipe valve.",
          "scene": "downstream-bank",
          "choices": [],
          "allowed": {
            "movement": {
              "mode": "local-area",
              "hexes": [],
              "rooms": [],
              "exteriorNodes": [],
              "transitions": []
            },
            "storyForwardActions": [
              "move-exterior:downstream-bank",
              "action:open-turbine-valve"
            ],
            "optionalActions": [],
            "storyChoices": [],
            "stageViews": [],
            "indoorActions": [
              "open-turbine-valve"
            ],
            "outdoorActions": [],
            "itemActions": [],
            "developerActions": []
          },
          "completesWhen": {
            "facility": {
              "hydro.manualValves.powerhouseOpen": true
            }
          },
          "onEnter": null,
          "onComplete": null,
          "next": "return-control-room"
        },
        {
          "id": "return-control-room",
          "title": "Return to the control room.",
          "scene": "control-room",
          "choices": [],
          "allowed": {
            "movement": {
              "mode": "local-area",
              "hexes": [],
              "rooms": [
                "control-room"
              ],
              "exteriorNodes": [],
              "transitions": []
            },
            "storyForwardActions": [
              "move-room:control-room"
            ],
            "optionalActions": [],
            "storyChoices": [],
            "stageViews": [],
            "indoorActions": [],
            "outdoorActions": [],
            "itemActions": [],
            "developerActions": []
          },
          "completesWhen": {
            "location": {
              "place": "indoors",
              "room": "control-room"
            }
          },
          "onEnter": null,
          "onComplete": null,
          "next": "connect-power"
        },
        {
          "id": "connect-power",
          "title": "Connect station power.",
          "scene": "control-room",
          "choices": [],
          "allowed": {
            "movement": {
              "mode": "current-location-only",
              "hexes": [],
              "rooms": [],
              "exteriorNodes": [],
              "transitions": []
            },
            "storyForwardActions": [
              "action:connect-power"
            ],
            "optionalActions": [],
            "storyChoices": [],
            "stageViews": [],
            "indoorActions": [
              "connect-power"
            ],
            "outdoorActions": [],
            "itemActions": [],
            "developerActions": []
          },
          "completesWhen": {
            "facility": {
              "hydro.online": true
            }
          },
          "onEnter": null,
          "onComplete": null,
          "next": "check-console"
        },
        {
          "id": "check-console",
          "title": "Check the generator console.",
          "scene": "control-room",
          "choices": [],
          "allowed": {
            "movement": {
              "mode": "current-location-only",
              "hexes": [],
              "rooms": [],
              "exteriorNodes": [],
              "transitions": []
            },
            "storyForwardActions": [
              "hydro-console:open"
            ],
            "optionalActions": [],
            "storyChoices": [],
            "stageViews": [
              {
                "kind": "console",
                "id": "hydro"
              }
            ],
            "indoorActions": [],
            "outdoorActions": [],
            "itemActions": [],
            "developerActions": []
          },
          "completesWhen": {
            "facility": {
              "hydro.online": true
            }
          },
          "onEnter": {
            "view": {
              "kind": "console",
              "id": "hydro",
              "focus": "generation"
            }
          },
          "onComplete": null,
          "next": "complete-startup"
        },
        {
          "id": "complete-startup",
          "title": "Bring the hydro generator online.",
          "scene": "control-room",
          "choices": [],
          "allowed": {
            "movement": {
              "mode": "unrestricted",
              "hexes": [],
              "rooms": [],
              "exteriorNodes": [],
              "transitions": []
            },
            "storyForwardActions": [],
            "optionalActions": [],
            "storyChoices": [],
            "stageViews": [],
            "indoorActions": [],
            "outdoorActions": [],
            "itemActions": [],
            "developerActions": []
          },
          "completesWhen": {
            "facility": {
              "hydro.startupComplete": true
            }
          },
          "onEnter": null,
          "onComplete": null,
          "next": null
        }
      ],
      "completion": null
    }
  ]
};
