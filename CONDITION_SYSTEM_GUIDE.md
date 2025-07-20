# Deal Verification Condition System

## How Conditions Are Determined

The condition system analyzes deal trigger text using **pattern matching** and **keyword detection**. Here's exactly how it works:

### Current Supported Conditions

#### 1. **Win Conditions**
- `"Any LA Dodgers win"` → Any game where team wins
- `"Home win"` → Win at home stadium only
- `"Win against Yankees"` → Any win (opponent doesn't matter yet)

#### 2. **Complex Win + Performance**
- `"Home win + 6 runs"` → Must win at home AND score 6+ runs
- `"Home win + 10 runs"` → Must win at home AND score 10+ runs

#### 3. **Score/Runs Based**
- `"6+ runs scored"` → Team scores 6 or more runs (win/loss doesn't matter)
- `"10+ runs"` → Team scores 10 or more runs
- `"Free tacos if Dodgers score 10+ runs"` → Extracted as 10+ runs requirement

#### 4. **Strikeout Conditions** 
- `"7+ strikeouts"` → **Batting strikeouts** (team got struck out 7+ times)
- `"Pitchers record 8+ strikeouts"` → **Pitching strikeouts** (team's pitchers struck out opponents)
- `"12+ strikeouts recorded"` → Pitching strikeouts (context suggests pitching)

#### 5. **Stolen Base Conditions**
- `"Stolen base at home"` → Any stolen base in home games
- `"Stolen base in World Series"` → Seasonal promotion (only during World Series)

#### 6. **Loss Conditions** (Consolation deals)
- `"Any loss"` → Team loses (for consolation promotions)
- `"Home loss"` → Lose at home stadium

## Pattern Detection Logic

### Step 1: Text Analysis
```typescript
const lowerCondition = condition.toLowerCase();

// Extract numbers: "10+ runs" → runsMatch = 10
const runsMatch = condition.match(/(\d+)\s*\+?\s*runs?/i);
const strikeoutMatch = condition.match(/(\d+)\s*\+?\s*strikeouts?/i);
```

### Step 2: Keyword Priority (Order Matters!)
1. **Complex conditions first**: "home win + runs" 
2. **Simple win conditions**: "win", "home win"
3. **Performance stats**: "runs", "strikeouts", "stolen"
4. **Default fallback**: Unknown → "any win"

### Step 3: Context Detection
- `"pitchers record"` or `"record strikeouts"` → **Pitching** strikeouts
- Just `"strikeouts"` → **Batting** strikeouts  
- `"home"` + `"win"` → Must be home game
- `"World Series"` → Seasonal condition

## How to Add New Conditions

### Example 1: Adding "Double/Triple" Conditions

**Step 1**: Add to the condition evaluation function:

```typescript
// In dealVerificationService.ts evaluateTriggerCondition()

// Add after strikeout conditions:
if (lowerCondition.includes('double') || lowerCondition.includes('triple')) {
  const doubleMatch = condition.match(/(\d+)\s*\+?\s*doubles?/i);
  const tripleMatch = condition.match(/(\d+)\s*\+?\s*triples?/i);
  
  const requiredDoubles = doubleMatch ? parseInt(doubleMatch[1]) : 1;
  const requiredTriples = tripleMatch ? parseInt(tripleMatch[1]) : 1;
  
  if (lowerCondition.includes('double')) {
    return (gameStats.doubles || 0) >= requiredDoubles;
  }
  if (lowerCondition.includes('triple')) {
    return (gameStats.triples || 0) >= requiredTriples;
  }
}
```

**Step 2**: Update game stats schema to include doubles/triples data
**Step 3**: Test new conditions with parse-condition API

### Example 2: Adding "Margin of Victory" Conditions

```typescript
// For conditions like "Win by 5+ runs" or "Blowout victory"
if (lowerCondition.includes('win by') || lowerCondition.includes('blowout')) {
  const marginMatch = condition.match(/win by (\d+)\s*\+?\s*(?:runs?|points?)/i);
  const requiredMargin = marginMatch ? parseInt(marginMatch[1]) : 5;
  
  const winMargin = didWin ? (game.teamScore - game.opponentScore) : 0;
  return didWin && winMargin >= requiredMargin;
}
```

### Example 3: Adding "Inning-Specific" Conditions

```typescript
// For conditions like "Walk-off win" or "Win in extra innings"
if (lowerCondition.includes('walk-off') || lowerCondition.includes('walkoff')) {
  return didWin && game.isHome && (gameStats.walkOff === true);
}

if (lowerCondition.includes('extra inning')) {
  return (gameStats.innings || 9) > 9;
}
```

## Real-World Examples

### Currently Working:
✅ `"Any LA Dodgers win"` → All 4 Panda Express deals
✅ `"Home win + 6 runs"` → McDonald's Big Mac deal  
✅ `"7+ strikeouts"` → Jack in the Box Curly Fries
✅ `"Free tacos if Dodgers score 10+ runs"` → Parsed as 10+ runs condition

### Just Added (Working Now!):
✅ `"Win by 5+ runs"` → Margin of victory (mock game: 8-3 = 5 run margin ✓)
✅ `"2+ home runs in game"` → Power hitting performance  
✅ `"Walk-off victory"` → Dramatic wins at home
✅ `"Extra innings thriller"` → Games that go beyond 9 innings

### Ready to Add:
🔄 `"Perfect game"` → Pitching excellence (0 hits allowed)
🔄 `"No-hitter"` → Elite pitching performance
🔄 `"Grand slam"` → 4-run home run
🔄 `"Shutout victory"` → Win without allowing runs

## Testing New Conditions

Use the parse-condition API to test:

```bash
curl -X POST "http://localhost:5000/api/deal-verification/parse-condition" \
  -H "Content-Type: application/json" \
  -d '{"condition":"Win by 5+ runs"}'
```

The system will:
1. Parse the condition 
2. Generate a mock game scenario
3. Test if the condition would trigger
4. Show exactly why it triggered or didn't

## Integration Points

1. **Deal Discovery**: AI extracts conditions from promotional text
2. **Admin Approval**: Conditions are editable during deal approval
3. **Game Processing**: Auto-evaluation after every completed game
4. **User Notifications**: Triggered deals sent via email/SMS

The system is **fully extensible** - just add new pattern matching logic and the entire verification pipeline automatically supports the new condition type!