# Calcutta Golf Auction — iOS App

A SwiftUI iOS app for running live golf Calcutta auctions. Teams are authenticated via 6-character access codes and can bid on teams in real-time, manage their portfolio, request buybacks, and accept/decline ownership group invitations.

---

## Requirements

| Requirement | Version |
|---|---|
| iOS | 17.0+ |
| Xcode | 15.0+ |
| Swift | 5.9+ |
| Supabase project | With Edge Functions deployed |

---

## Creating the Xcode Project

These source files are **not** an Xcode project. Follow these steps to integrate them:

### Step 1 — Create a new iOS App project

1. Open Xcode → **File → New → Project…**
2. Choose **App** under iOS
3. Set:
   - **Product Name:** `CacuttaApp`
   - **Interface:** SwiftUI
   - **Language:** Swift
   - **Minimum Deployments:** iOS 17.0

### Step 2 — Add the Swift Package dependency

1. In Xcode, go to **File → Add Package Dependencies…**
2. Enter the URL: `https://github.com/supabase/supabase-swift`
3. Select **Up Next Major Version** from `2.0.0`
4. Add the **Supabase** library to your target

### Step 3 — Add the source files

1. In Finder, open this folder (`ios-app/Sources/CacuttaApp/`)
2. In Xcode's Project Navigator, select your project group
3. Drag the entire `Sources/CacuttaApp/` directory into Xcode
4. When prompted, select **Copy items if needed** and **Create groups**
5. Make sure all files are added to your app target

Your project navigator should look like:

```
CacuttaApp/
├── CacuttaApp.swift              ← App entry point (@main)
├── Models/
│   ├── Tournament.swift
│   ├── Team.swift
│   ├── AuctionSession.swift
│   ├── Bid.swift
│   ├── Ownership.swift
│   ├── BuybackRequest.swift
│   ├── OwnershipGroupInvite.swift
│   ├── Flight.swift
│   └── HistoricalStats.swift
├── Services/
│   ├── SupabaseService.swift
│   ├── AuthService.swift
│   ├── AuctionService.swift
│   ├── BuybackService.swift
│   ├── OwnershipGroupService.swift
│   └── TournamentService.swift
├── ViewModels/
│   ├── AuthViewModel.swift
│   ├── AuctionViewModel.swift
│   ├── PortfolioViewModel.swift
│   └── HistoricalStatsViewModel.swift
├── Views/
│   ├── Auth/
│   │   ├── WelcomeView.swift
│   │   ├── AccessCodeView.swift
│   │   └── AccountLoginView.swift
│   ├── Main/
│   │   └── MainTabView.swift
│   ├── Auction/
│   │   ├── LiveAuctionView.swift
│   │   ├── AuctionTimerView.swift
│   │   ├── BidInputView.swift
│   │   ├── BidFeedView.swift
│   │   ├── TeamAuctionCard.swift
│   │   ├── AllTeamsListView.swift
│   │   └── TeamRowView.swift
│   ├── Portfolio/
│   │   ├── PortfolioView.swift
│   │   ├── OwnedTeamCard.swift
│   │   ├── BuybackPromptSheet.swift
│   │   ├── BuybackConfirmView.swift
│   │   └── GroupInviteSheet.swift
│   ├── Tournament/
│   │   ├── TournamentInfoView.swift
│   │   ├── FlightStandingsView.swift
│   │   └── TeamHistoricalStatsView.swift
│   └── Components/
│       ├── GolfGreenButton.swift
│       ├── StatBox.swift
│       ├── LoadingView.swift
│       ├── EmptyStateView.swift
│       ├── ToastView.swift
│       └── CurrencyText.swift
└── Utilities/
    ├── KeychainHelper.swift
    └── HapticManager.swift
```

### Step 4 — Configure Info.plist

Add the following keys to your app target's `Info.plist`:

```xml
<key>SUPABASE_URL</key>
<string>https://your-project-ref.supabase.co</string>

<key>SUPABASE_ANON_KEY</key>
<string>your-supabase-anon-key</string>
```

**Never hardcode credentials in source files.** Use environment-specific `.xcconfig` files for CI/CD to inject these values per environment.

### Step 5 — Build & Run

Select your target device or simulator (iOS 17+) and press **⌘R**.

---

## Architecture Overview

### Auth Flow

```
App Launch
    ↓
KeychainHelper.retrieveToken()
    ↓ (token exists + not expired)
AuthState.codeAuthenticated → MainTabView
    ↓ (no token)
WelcomeView → AccessCodeView
    ↓ (POST /functions/v1/validate-access-code)
Returns { token, team: { id, player1_name, player2_name, tournament } }
    ↓
Token stored in Keychain → MainTabView
```

All subsequent API calls include `Authorization: Bearer {token}` from Keychain.
The JWT's `sub` claim equals the `team_id`, so `auth.uid() = team_id` in Supabase RLS.

### Real-time

`AuctionService` subscribes to a Supabase Realtime broadcast channel named `auction:{tournament_id}`. Events flow through a `PassthroughSubject<AuctionRealtimeEvent, Never>` which ViewModels subscribe to via Combine.

### Timer

The auction timer is **server-authoritative**. The `AuctionSession` model computes `timerRemaining` from `timerStartedAt + timerDurationSeconds - now`. `AuctionViewModel` refreshes this every 100ms via a Timer publisher.

### MVVM

```
View ←→ ViewModel ←→ Service ←→ Supabase
```

- **Views** are pure SwiftUI, no business logic
- **ViewModels** hold UI state and coordinate services
- **Services** are `@MainActor` singletons handling network + realtime
- **Models** are `Codable` structs matching the database schema

---

## Supabase Edge Functions Required

| Function | Method | Description |
|---|---|---|
| `validate-access-code` | POST | Validates 6-char code, returns JWT + team |
| `place-bid` | POST | Places a bid on the active auction session |
| `request-buyback` | POST | Sold team requests a buyback |
| `confirm-buyback` | POST | Winning bidder confirms cash received |
| `decline-buyback` | POST | Winning bidder declines buyback |
| `send-group-invite` | POST | Sends an ownership group invite |
| `accept-group-invite` | POST | Accepts an ownership group invite |
| `decline-group-invite` | POST | Declines an ownership group invite |

### Database Function

| Function | Returns | Description |
|---|---|---|
| `get_pair_historical_stats(p1, p2)` | `HistoricalStats` | Returns historical stats for a player pairing |

---

## Database Tables

| Table | Description |
|---|---|
| `tournaments` | Tournament records with auction settings (JSONB) |
| `teams` | Teams with player names, handicaps, access codes |
| `auction_sessions` | One per team per tournament, tracks bids and timer |
| `bids` | Individual bid records |
| `ownerships` | Ownership stakes by team |
| `buyback_requests` | Buyback requests from sold teams |
| `ownership_group_invites` | Invitations to share ownership |
| `flights` | Tournament flights with payout tier definitions |
| `flight_results` | Final standings and payouts |

---

## Design System

| Token | Value | Use |
|---|---|---|
| Background | `#020617` | App background |
| Surface | `#0f172a` | Cards, sheets |
| Primary | `#16a34a` | Buttons, active state |
| Accent | `#22c55e` | Timer, high bids, wins |
| Warning | `#eab308` | Timer < 10s, buybacks |
| Danger | `#ef4444` | Timer < 3s, decline |
| Text Secondary | `#94a3b8` | Labels, subtitles |
| Text Tertiary | `#64748b` | Footnotes, timestamps |

---

## Notes

- **No UIKit** — all views are SwiftUI
- **Keychain** is used for token storage (not UserDefaults)
- **All currency** is stored as cents (Int) and formatted to dollars in the UI
- **Realtime reconnects** automatically via Supabase Swift SDK
- **Haptic feedback** is provided for key auction events (bids, sold, outbid, timer extension)
- The app functions without a full account — the 6-char access code is the only required authentication
