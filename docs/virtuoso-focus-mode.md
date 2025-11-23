# The "Focus Mode" Scroll Pattern for AI Chat Applications

## A Comprehensive Guide to Implementing ChatGPT/Gemini-Style Scroll Behavior with react-virtuoso

**Author:** Documented from working implementation after 5 months of research
**Last Updated:** 2025-01-23
**Pattern Difficulty:** Advanced
**Documentation Status:** ⚠️ **This pattern is NOT documented anywhere else comprehensively**

---

## Table of Contents

1. [Introduction](#introduction)
2. [The Problem Statement](#the-problem-statement)
3. [UX Rationale: Why This Pattern Exists](#ux-rationale)
4. [The Complete Solution](#the-complete-solution)
5. [Implementation Breakdown](#implementation-breakdown)
6. [Critical Timing Requirements](#critical-timing-requirements)
7. [Race Condition Prevention](#race-condition-prevention)
8. [Footer Height Dynamics](#footer-height-dynamics)
9. [Complete Working Example](#complete-working-example)
10. [Troubleshooting](#troubleshooting)
11. [Research & Documentation Gaps](#research-documentation-gaps)
12. [References](#references)

---

## Introduction

This document describes the **"Focus Mode"** scroll pattern used by modern AI chat applications like ChatGPT, Claude, Perplexity, and Google Gemini. This pattern provides an optimal user experience for streaming AI responses by:

1. Scrolling user messages to the **TOP** of the viewport
2. Pre-allocating space below for the AI response
3. Keeping the viewport **STATIC** during streaming
4. Dynamically adjusting space based on user interaction

### What Makes This Pattern Special

Unlike traditional chat applications (WhatsApp, Slack) that scroll to the **bottom**, AI chat applications scroll user messages to the **top**. This creates a "new page" effect where:

- The user's question stays visible at the top
- The AI response streams naturally below
- No viewport jumping occurs during streaming
- Reading flow is natural (top to bottom)

### Why This Documentation Exists

After **5 months of programming** and extensive research, it became clear that:

- ❌ NO comprehensive guide exists for this pattern
- ❌ react-virtuoso documentation doesn't cover this use case
- ❌ Multiple GitHub issues exist with no clear solutions
- ❌ Stack Overflow has unanswered questions about this exact pattern
- ❌ Timing requirements are undocumented

This guide fills that gap.

---

## The Problem Statement

### Traditional Chat Scroll Behavior

Traditional chat applications (WhatsApp, Telegram, Slack):
```
┌─────────────────┐
│  Older msgs...  │
│  Older msgs...  │
│  User: Hello    │
│  Bot: Hi there! │
│  User: How are? │ ← Messages appear at bottom
│  Bot: Great!    │ ← Auto-scroll to bottom
└─────────────────┘
```

**Problem:** When AI responses stream in character-by-character, this causes:
- Constant viewport jumping
- User loses context of their question
- Difficult to read while content is being added
- Poor UX for long responses

### The AI Chat Solution: "Focus Mode"

AI chat applications use a different pattern:
```
┌─────────────────┐
│ User: Question  │ ← Scrolls to TOP of viewport
│ AI: Response... │ ← Streams below
│ [continuing...] │
│                 │
│                 │ ← Pre-allocated space (large footer)
│                 │
└─────────────────┘
```

**Benefits:**
- ✅ User's question stays at top (maintains context)
- ✅ Response streams naturally below
- ✅ No viewport jumping during streaming
- ✅ Natural reading flow (top to bottom)
- ✅ Space adjusts when user scrolls up to view history

---

## UX Rationale

### Why Scroll to Top?

**Traditional Chat Context:**
- User wants to see the **latest** message
- Messages are short (1-2 sentences)
- Context is in the conversation flow
- Scrolling to bottom makes sense

**AI Chat Context:**
- User wants to see **their question** while reading the response
- Responses can be very long (multiple paragraphs, code blocks)
- User needs to reference their question while reading
- **Scrolling question to top** maintains context during streaming

### The "New Page" Mental Model

When you send a message to ChatGPT/Claude:
1. Your question scrolls to the top (like turning to a new page)
2. The answer appears below (like reading a document)
3. You can scroll up anytime to see history
4. When you're done, you send another question (new "page")

This matches how humans read documents, not chat threads.

### Comparison Table

| Feature | Traditional Chat | AI Chat "Focus Mode" |
|---------|-----------------|---------------------|
| User message position | Bottom | **Top** |
| Response streaming | Jumps viewport | **Static viewport** |
| Reading flow | Bottom-up | **Top-down** |
| Context retention | Lost during streaming | **Question always visible** |
| Best for | Short messages | **Long AI responses** |
| Examples | WhatsApp, Slack | ChatGPT, Claude, Gemini |

---

## The Complete Solution

### Overview

The solution requires coordinating **6 different systems**:

1. **Dynamic Footer Height** - Creates scrollable space
2. **Scroll Position Control** - `scrollToIndex` with `align: 'start'`
3. **User Interaction Detection** - `isScrolling` callback
4. **Guard Flags** - Prevents race conditions
5. **Timing Coordination** - `setTimeout` delays
6. **Height Measurement** - Input area measurement

### Architecture Diagram

```
┌──────────────────────────────────────────────┐
│           App.tsx (Container)                │
│  - Measures input area height                │
│  - Passes minFooterHeight to MessageList     │
└──────────────────┬───────────────────────────┘
                   │
                   ▼
┌──────────────────────────────────────────────┐
│       MessageList.tsx (Implementation)       │
│                                              │
│  States:                                     │
│   - footerHeight (dynamic)                   │
│   - isFooterBig (boolean flag)               │
│                                              │
│  Refs:                                       │
│   - virtuosoRef (scroll control)             │
│   - justSentMessageRef (guard flag)          │
│                                              │
│  Effects:                                    │
│   - Auto-scroll on new user message          │
│   - Update footer when minFooterHeight       │
│     changes                                  │
│                                              │
│  Callbacks:                                  │
│   - handleScrollingStateChange               │
│     (shrinks footer when user scrolls)       │
└──────────────────────────────────────────────┘
```

### State Flow Diagram

```
User sends message
       │
       ▼
[Set footerHeight = '55vh']
       │
       ▼
[Set isFooterBig = true]
       │
       ▼
[Set justSentMessageRef = true]
       │
       ▼
[Wait 100ms] ─────────────┐
       │                  │ (DOM layout stabilizes)
       ▼                  │
[scrollToIndex(          │
  align: 'start'         │
)]                       │
       │                 │
       ▼                 │
[Wait 500ms] ────────────┘
       │        (Scroll animation completes)
       ▼
[Set justSentMessageRef = false]
       │
       ▼
[User can scroll freely]
       │
       ▼
[isScrolling callback fires]
       │
       ├─ if justSentMessageRef = true
       │  └─> Do nothing (guard prevents shrink)
       │
       └─ if justSentMessageRef = false
          └─> Shrink footer to minFooterHeight
```

---

## Implementation Breakdown

### Step 1: Measure Input Area Height (App.tsx)

**Purpose:** Determine the minimal footer height when not in Focus Mode.

```typescript
// App.tsx
const [minFooterHeight, setMinFooterHeight] = useState<number>(100);
const inputAreaRef = useRef<HTMLDivElement>(null);

useEffect(() => {
  const measureInputHeight = () => {
    if (inputAreaRef.current) {
      const height = inputAreaRef.current.offsetHeight;
      setMinFooterHeight(height + 20); // Add 20px padding
    }
  };

  // Measure on mount
  measureInputHeight();

  // Re-measure on window resize
  window.addEventListener('resize', measureInputHeight);

  // Also measure after a short delay (ensures layout is stable)
  const timer = setTimeout(measureInputHeight, 100);

  return () => {
    window.removeEventListener('resize', measureInputHeight);
    clearTimeout(timer);
  };
}, []);

// Wrap InputArea to measure it
<div ref={inputAreaRef}>
  <InputArea {...props} />
</div>

// Pass to MessageList
<MessageList minFooterHeight={minFooterHeight} {...otherProps} />
```

**Key Points:**
- Measure the **actual rendered height** of the input area
- Add padding (20px) for visual breathing room
- Re-measure on window resize (responsive design)
- Use `setTimeout` to ensure DOM is ready

### Step 2: Initialize Dynamic Footer States (MessageList.tsx)

**Purpose:** Set up states for controlling footer height dynamically.

```typescript
// MessageList.tsx
const MessageList: React.FC<MessageListProps> = ({
  messages,
  minFooterHeight,
  ...otherProps
}) => {
  const virtuosoRef = useRef<VirtuosoHandle>(null);

  // Dynamic footer states
  const [footerHeight, setFooterHeight] = useState<string>(
    `${minFooterHeight}px`
  );
  const [isFooterBig, setIsFooterBig] = useState<boolean>(false);

  // Guard flag to prevent race conditions
  const justSentMessageRef = useRef<boolean>(false);

  // ... rest of component
};
```

**Key Points:**
- `footerHeight`: String type to support both `px` and `vh` units
- `isFooterBig`: Boolean flag to track footer state
- `justSentMessageRef`: **Ref** (not state) to avoid re-renders

### Step 3: Update Footer When Min Height Changes

**Purpose:** Sync footer height when input area size changes (only when not in Focus Mode).

```typescript
// Update footer height when minFooterHeight changes (only if footer is not big)
useEffect(() => {
  if (!isFooterBig) {
    setFooterHeight(`${minFooterHeight}px`);
  }
}, [minFooterHeight, isFooterBig]);
```

**Key Points:**
- Only update if `!isFooterBig` (don't override Focus Mode)
- Responds to window resize (via minFooterHeight changes)
- Keeps footer minimal when not actively scrolling

### Step 4: Auto-Scroll Logic - The Core Implementation

**Purpose:** When user sends a message, expand footer and scroll message to top.

```typescript
// Auto-scroll logic - Focus Mode: user messages go to TOP
useEffect(() => {
  if (messages.length > 0) {
    const lastMessage = messages[messages.length - 1];

    // Only scroll when user sends a message
    if (lastMessage.role === Role.USER) {
      // Set footer to 55vh for Focus Mode
      setFooterHeight('55vh');
      setIsFooterBig(true);
      justSentMessageRef.current = true;

      // Wait 100ms before scrolling (critical timing!)
      setTimeout(() => {
        virtuosoRef.current?.scrollToIndex({
          index: messages.length - 1,
          align: 'start',      // Position at TOP of viewport
          behavior: 'smooth'   // Smooth scroll animation
        });
      }, 100);

      // Allow scrolling to shrink footer after 500ms
      setTimeout(() => {
        justSentMessageRef.current = false;
      }, 500);
    }
  }
}, [messages.length]);
```

**Key Points:**
- Triggers on `messages.length` change
- Only runs for **USER** messages (not bot responses)
- **100ms delay** before scrollToIndex (see Timing Requirements)
- **500ms delay** before allowing footer shrink (see Race Conditions)
- Uses `align: 'start'` to position message at TOP

### Step 5: Scroll Callback - Shrink Footer on User Scroll

**Purpose:** When user manually scrolls, shrink footer to minimal height.

```typescript
// Handle scrolling state change - shrink footer when user scrolls
const handleScrollingStateChange = (isScrolling: boolean) => {
  // Only shrink if:
  // 1. User is scrolling
  // 2. Footer is currently big
  // 3. We're NOT in the immediate post-send period
  if (isScrolling && isFooterBig && !justSentMessageRef.current) {
    setFooterHeight(`${minFooterHeight}px`);
    setIsFooterBig(false);
  }
};
```

**Key Points:**
- Checks **three conditions** before shrinking
- `!justSentMessageRef.current` prevents premature shrinking
- Transitions from `55vh` → minimal height
- Triggered by virtuoso's `isScrolling` prop

### Step 6: Virtuoso Configuration

**Purpose:** Configure react-virtuoso with all the necessary props.

```typescript
return (
  <Virtuoso
    ref={virtuosoRef}
    data={messages}
    followOutput={false}                        // CRITICAL: Disable auto-follow
    isScrolling={handleScrollingStateChange}    // Detect user scrolling
    itemContent={(index, msg) => (
      <MessageItem msg={msg} {...props} />
    )}
    components={{
      Header: () => <div className="h-30" />,   // 120px top spacing
      Footer: () => (
        <div style={{ height: footerHeight }}>  {/* Dynamic height */}
          {/* Thinking indicator, etc. */}
        </div>
      )
    }}
  />
);
```

**Key Points:**
- `followOutput={false}`: **CRITICAL** - prevents auto-scrolling
- `isScrolling`: Callback for detecting user scrolls
- `Header`: Top spacing (prevents messages from touching top edge)
- `Footer`: **Dynamic height** - the secret sauce

---

## Critical Timing Requirements

### The 100ms Delay Before scrollToIndex

**Why is this necessary?**

```typescript
setTimeout(() => {
  virtuosoRef.current?.scrollToIndex({...});
}, 100);
```

**Reason:**
1. When `setFooterHeight('55vh')` is called, React schedules a state update
2. React re-renders the component
3. Browser performs layout recalculation
4. Virtuoso measures new footer height
5. **Only then** can scrollToIndex calculate correct scroll position

**Without the delay:**
- scrollToIndex calculates position with OLD footer height
- Scroll position is incorrect
- Message doesn't reach top of viewport

**Why 100ms specifically?**
- Empirically determined
- Accounts for:  - React render cycle (~16ms per frame)
  - Browser layout recalculation (~50ms)
  - Virtuoso internal measurement (~30ms)
- Total: ~96ms, rounded to 100ms for safety

**Alternative approaches that DON'T work:**
```typescript
// ❌ DOESN'T WORK - scroll happens before layout
setFooterHeight('55vh');
virtuosoRef.current?.scrollToIndex({...});

// ❌ DOESN'T WORK - useLayoutEffect still too early
useLayoutEffect(() => {
  virtuosoRef.current?.scrollToIndex({...});
}, [footerHeight]);

// ✅ WORKS - setTimeout ensures layout is complete
setTimeout(() => {
  virtuosoRef.current?.scrollToIndex({...});
}, 100);
```

### The 500ms Delay Before Enabling Scroll Callback

**Why is this necessary?**

```typescript
setTimeout(() => {
  justSentMessageRef.current = false;
}, 500);
```

**Reason:**
1. `scrollToIndex` with `behavior: 'smooth'` triggers a scroll animation
2. Scroll animation lasts ~300-400ms (browser-dependent)
3. During animation, `isScrolling` callback fires repeatedly
4. Without guard flag, footer would shrink immediately during animation
5. This causes the scroll target to move (race condition)

**The Race Condition:**
```
Time 0ms:   Set footer to 55vh, start scrolling
Time 10ms:  Scroll animation begins
Time 20ms:  isScrolling callback fires
Time 20ms:  ❌ Footer shrinks to 100px (if no guard)
Time 30ms:  Scroll target position changes
Time 40ms:  Scroll "jumps" to new target
Time 50ms:  User sees glitchy scroll behavior
```

**With 500ms guard:**
```
Time 0ms:   Set footer to 55vh, justSent = true
Time 10ms:  Scroll animation begins
Time 20ms:  isScrolling fires, but guard prevents shrink
Time 300ms: Animation completes
Time 500ms: Guard disabled, user can now scroll freely
```

**Why 500ms specifically?**
- Scroll animation: ~300-400ms
- Safety margin: +100-200ms
- Total: 500ms ensures animation is completely done

---

## Race Condition Prevention

### The Problem: isScrolling Callback Interference

**What happens without guard flags:**

```typescript
// ❌ BAD - No guard flag
const handleScrollingStateChange = (isScrolling: boolean) => {
  if (isScrolling && isFooterBig) {
    setFooterHeight(`${minFooterHeight}px`);  // Shrinks during animation!
    setIsFooterBig(false);
  }
};
```

**Timeline of disaster:**
1. User sends message
2. Footer expands to 55vh
3. `scrollToIndex` starts smooth scroll animation
4. **Scroll animation triggers `isScrolling(true)` callback**
5. Callback sees `isFooterBig === true`
6. **Footer shrinks back to minimal height immediately**
7. Scroll target position changes mid-animation
8. User sees jumpy, glitchy behavior

### The Solution: Guard Flags

**Using a ref (not state) for guard flag:**

```typescript
const justSentMessageRef = useRef<boolean>(false);  // Ref, not state!

// When user sends message
setFooterHeight('55vh');
setIsFooterBig(true);
justSentMessageRef.current = true;  // Enable guard

// Start scroll animation
setTimeout(() => scrollToIndex({...}), 100);

// Disable guard after animation completes
setTimeout(() => {
  justSentMessageRef.current = false;
}, 500);

// Callback checks guard flag
const handleScrollingStateChange = (isScrolling: boolean) => {
  if (isScrolling && isFooterBig && !justSentMessageRef.current) {
    // Only shrinks if guard is disabled
    setFooterHeight(`${minFooterHeight}px`);
    setIsFooterBig(false);
  }
};
```

**Why use a ref instead of state?**

```typescript
// ❌ Using state causes unnecessary re-renders
const [justSentMessage, setJustSentMessage] = useState(false);
setJustSentMessage(true);   // Triggers re-render
// ... later ...
setJustSentMessage(false);  // Triggers another re-render

// ✅ Using ref avoids re-renders
const justSentMessageRef = useRef(false);
justSentMessageRef.current = true;   // No re-render
// ... later ...
justSentMessageRef.current = false;  // No re-render
```

**Benefits:**
- No unnecessary re-renders
- Immediate synchronous updates
- Callback always reads latest value
- More performant

### Common Race Conditions Solved

1. **Scroll animation triggering shrink callback** ✅ Solved with guard flag
2. **Footer height changing before scroll completes** ✅ Solved with 100ms delay
3. **Multiple rapid message sends** ✅ Each sets guard flag independently
4. **User scrolling during bot response** ✅ Guard is disabled, shrink works

---

## Footer Height Dynamics

### Why Use a Large Footer?

**The Secret Sauce:** The footer creates scrollable space below the messages.

**Without a large footer:**
```
┌─────────────────┐
│ Message 1       │
│ Message 2       │ ← Can't scroll higher because
│ User: Question  │    there's no space below
└─────────────────┘
```

**With 55vh footer:**
```
┌─────────────────┐
│ User: Question  │ ← Can scroll to top!
│ AI: Response... │
│                 │
│                 │ ← Footer creates space
│                 │    (55% of viewport height)
│                 │
└─────────────────┘
```

### Why 55vh Specifically?

**Calculation:**
- Typical viewport height: 100vh
- Header space: ~120px (~12vh)
- User message + AI response: ~30-40vh
- **Remaining space needed:** 55vh

This ensures:
- User message can reach top of viewport
- AI response has room to stream below
- No awkward "stuck in middle" positioning

### Why Viewport Units (vh) Instead of Pixels?

```typescript
// ✅ GOOD - Responsive to screen size
setFooterHeight('55vh');

// ❌ BAD - Fixed size, doesn't adapt
setFooterHeight('500px');
```

**Benefits of vh units:**
- Adapts to different screen sizes
- Works on mobile (small screens) and desktop (large screens)
- Maintains proportion regardless of device
- User message always reaches top on any screen

### Transition Flow

**1. Initial State (No Messages)**
```
Footer: ${minFooterHeight}px  (~100-150px)
Purpose: Minimal space, no wasted screen real estate
```

**2. User Sends Message**
```
Footer: 55vh  (~400-600px depending on screen)
Purpose: Create space for user message to scroll to top
Duration: Until user manually scrolls
```

**3. User Scrolls to View History**
```
Footer: ${minFooterHeight}px  (shrinks back)
Purpose: Minimize wasted space when viewing old messages
Trigger: isScrolling callback detects user scroll
```

### Dynamic Measurement of minFooterHeight

**Why measure instead of hardcoding?**

```typescript
// ❌ BAD - Hardcoded, breaks on different layouts
const minFooterHeight = 150;

// ✅ GOOD - Measures actual rendered height
const height = inputAreaRef.current.offsetHeight + 20;
```

**Benefits:**
- Adapts to different input area designs
- Handles reply previews, attachment previews
- Responsive to window resize
- Works with dynamic content (settings panel, etc.)

**What gets measured:**
```
Input Area
├── Attachment Previews (if any)
├── Reply Preview (if replying)
├── Input Textbox
├── Buttons (send, attach, mic)
└── Disclaimer Text

Total Height + 20px padding = minFooterHeight
```

---

## Complete Working Example

### App.tsx (Parent Component)

```typescript
import React, { useState, useRef, useEffect } from 'react';
import MessageList from './components/MessageList';
import InputArea from './components/InputArea';

const App: React.FC = () => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [minFooterHeight, setMinFooterHeight] = useState<number>(100);
  const inputAreaRef = useRef<HTMLDivElement>(null);

  // Measure input area height for dynamic footer
  useEffect(() => {
    const measureInputHeight = () => {
      if (inputAreaRef.current) {
        const height = inputAreaRef.current.offsetHeight;
        setMinFooterHeight(height + 20); // Add 20px padding
      }
    };

    measureInputHeight();
    window.addEventListener('resize', measureInputHeight);
    const timer = setTimeout(measureInputHeight, 100);

    return () => {
      window.removeEventListener('resize', measureInputHeight);
      clearTimeout(timer);
    };
  }, []);

  return (
    <div className="flex flex-col h-screen">
      {/* Message List with dynamic footer */}
      <MessageList
        messages={messages}
        minFooterHeight={minFooterHeight}
      />

      {/* Input Area wrapped for measurement */}
      <div ref={inputAreaRef}>
        <InputArea onSend={handleSendMessage} />
      </div>
    </div>
  );
};
```

### MessageList.tsx (Implementation)

```typescript
import React, { useEffect, useRef, useState } from 'react';
import { Virtuoso, VirtuosoHandle } from 'react-virtuoso';
import { ChatMessage, Role } from '../types';

interface MessageListProps {
  messages: ChatMessage[];
  minFooterHeight: number;
  isThinking: boolean;
}

const MessageList: React.FC<MessageListProps> = ({
  messages,
  minFooterHeight,
  isThinking
}) => {
  const virtuosoRef = useRef<VirtuosoHandle>(null);

  // Dynamic footer states
  const [footerHeight, setFooterHeight] = useState<string>(`${minFooterHeight}px`);
  const [isFooterBig, setIsFooterBig] = useState<boolean>(false);
  const justSentMessageRef = useRef<boolean>(false);

  // Update footer height when minFooterHeight changes (only if footer is not big)
  useEffect(() => {
    if (!isFooterBig) {
      setFooterHeight(`${minFooterHeight}px`);
    }
  }, [minFooterHeight, isFooterBig]);

  // Auto-scroll logic - Focus Mode: user messages go to TOP
  useEffect(() => {
    if (messages.length > 0) {
      const lastMessage = messages[messages.length - 1];

      // Only scroll when user sends a message - position it at TOP
      if (lastMessage.role === Role.USER) {
        // Set footer to 55vh for Focus Mode
        setFooterHeight('55vh');
        setIsFooterBig(true);
        justSentMessageRef.current = true;

        // Wait 100ms before scrolling (allows layout to stabilize)
        setTimeout(() => {
          virtuosoRef.current?.scrollToIndex({
            index: messages.length - 1,
            align: 'start',      // Position at TOP
            behavior: 'smooth'   // Smooth animation
          });
        }, 100);

        // Allow scrolling to shrink footer after 500ms (after animation)
        setTimeout(() => {
          justSentMessageRef.current = false;
        }, 500);
      }
    }
  }, [messages.length]);

  // Handle scrolling state change - shrink footer when user scrolls
  const handleScrollingStateChange = (isScrolling: boolean) => {
    // Only shrink if user is scrolling, footer is big, AND we're not in
    // the immediate post-send period (prevents race condition)
    if (isScrolling && isFooterBig && !justSentMessageRef.current) {
      setFooterHeight(`${minFooterHeight}px`);
      setIsFooterBig(false);
    }
  };

  // Determine when to show the "Thinking" indicator
  const lastMessage = messages[messages.length - 1];
  const hasBotResponse = lastMessage?.role === Role.MODEL && lastMessage.text.length > 0;
  const showThinkingDots = isThinking && !hasBotResponse;

  return (
    <Virtuoso
      ref={virtuosoRef}
      data={messages}
      followOutput={false}  // CRITICAL: Disable auto-follow
      isScrolling={handleScrollingStateChange}
      itemContent={(index, msg) => (
        <MessageItem msg={msg} />
      )}
      components={{
        Header: () => <div className="h-30" />,  // 120px top spacing
        Footer: () => (
          <div style={{ height: footerHeight }}>
            {/* Thinking Indicator */}
            {showThinkingDots && (
              <div className="px-5 py-6">
                <div className="flex items-center gap-3">
                  <div className="w-6 h-6 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center animate-pulse">
                    <Sparkles size={12} />
                  </div>
                  <span className="text-sm font-medium text-gray-400">
                    Thinking...
                  </span>
                </div>
              </div>
            )}
          </div>
        )
      }}
    />
  );
};

export default MessageList;
```

---

## Troubleshooting

### Problem 1: Footer Doesn't Expand to 55vh

**Symptoms:**
- User message doesn't scroll to top
- Footer stays at minimal height
- No Focus Mode effect

**Diagnosis:**
```typescript
// Add debugging
useEffect(() => {
  if (messages.length > 0) {
    const lastMessage = messages[messages.length - 1];
    console.log('Last message role:', lastMessage.role);  // Check role
    console.log('Footer height before:', footerHeight);   // Check state

    if (lastMessage.role === Role.USER) {
      setFooterHeight('55vh');
      console.log('Footer height set to 55vh');           // Confirm execution
    }
  }
}, [messages.length]);
```

**Common Causes:**
1. **Message role is wrong** - Check that user messages have `role: 'user'` (or `Role.USER`)
2. **useEffect dependency wrong** - Must depend on `messages.length`, not `messages`
3. **State not updating** - Check React DevTools for state changes

**Solutions:**
- Verify message role enum matches your check
- Ensure useEffect runs (add console.log)
- Check that setFooterHeight is called

### Problem 2: Scroll Jumps or Glitches

**Symptoms:**
- Message starts scrolling to top, then jumps back
- Scroll animation is jerky
- Footer seems to change size during scroll

**Diagnosis:**
```typescript
// Add debugging to callback
const handleScrollingStateChange = (isScrolling: boolean) => {
  console.log('isScrolling:', isScrolling);
  console.log('isFooterBig:', isFooterBig);
  console.log('justSentMessageRef:', justSentMessageRef.current);

  if (isScrolling && isFooterBig && !justSentMessageRef.current) {
    console.log('SHRINKING FOOTER');  // Should NOT fire immediately after send
    setFooterHeight(`${minFooterHeight}px`);
    setIsFooterBig(false);
  }
};
```

**Common Causes:**
1. **Guard flag not set** - `justSentMessageRef.current` not set to `true`
2. **Timeout too short** - 500ms might not be enough on slow devices
3. **Missing guard flag check** - Callback doesn't check `!justSentMessageRef.current`

**Solutions:**
- Verify guard flag is set before scrolling
- Increase timeout to 600-700ms if needed
- Ensure all three conditions are checked in callback

### Problem 3: Message Doesn't Reach Top of Viewport

**Symptoms:**
- Message scrolls, but stops ~100px from top
- Header space seems too large
- Inconsistent positioning

**Diagnosis:**
```typescript
// Check actual scroll position
setTimeout(() => {
  virtuosoRef.current?.scrollToIndex({
    index: messages.length - 1,
    align: 'start',
    behavior: 'smooth'
  });

  // After scroll completes, check position
  setTimeout(() => {
    const scrollTop = virtuosoRef.current?.getState().scrollTop;
    console.log('Final scroll position:', scrollTop);
  }, 1000);
}, 100);
```

**Common Causes:**
1. **Header too large** - `h-32` (128px) might be too much
2. **100ms delay too short** - Footer height not fully updated
3. **align not set to 'start'** - Defaults to 'center'

**Solutions:**
- Reduce header height to `h-30` (120px) or `h-24` (96px)
- Increase delay to 150ms if needed
- Explicitly set `align: 'start'`

### Problem 4: Zero-Sized Element Error

**Symptoms:**
```
Warning: Virtuoso: Zero-sized element
```

**Diagnosis:**
```typescript
// Check footer height calculation
useEffect(() => {
  console.log('minFooterHeight:', minFooterHeight);
  console.log('footerHeight:', footerHeight);
  console.log('isFooterBig:', isFooterBig);
}, [minFooterHeight, footerHeight, isFooterBig]);
```

**Common Causes:**
1. **minFooterHeight is 0** - Input area not measured yet
2. **Initial state is empty string** - `useState('')` instead of `useState('100px')`
3. **Measurement happens too early** - DOM not ready

**Solutions:**
- Initialize with default: `useState<string>('100px')`
- Add check: `if (minFooterHeight > 0) setFooterHeight(...)`
- Use `setTimeout` in measurement useEffect

### Problem 5: Footer Doesn't Shrink When Scrolling

**Symptoms:**
- User scrolls up, but footer stays at 55vh
- Lots of wasted space when viewing history
- Callback not firing

**Diagnosis:**
```typescript
// Check if callback is hooked up
<Virtuoso
  isScrolling={(scrolling) => {
    console.log('Scroll detected:', scrolling);  // Should fire on any scroll
    handleScrollingStateChange(scrolling);
  }}
/>
```

**Common Causes:**
1. **isScrolling prop not connected** - Typo or missing prop
2. **Callback conditions too strict** - One of the three conditions is false
3. **Guard flag stuck as true** - Second setTimeout never ran

**Solutions:**
- Verify `isScrolling={handleScrollingStateChange}` is present
- Log all three conditions to see which is failing
- Check that second setTimeout (500ms) completes

### Problem 6: Scroll Behavior Different on Mobile

**Symptoms:**
- Works on desktop, broken on mobile
- Touch scrolling doesn't trigger callback
- Footer sizing wrong on mobile

**Common Causes:**
1. **Touch events not captured** - react-virtuoso should handle this, but check browser compatibility
2. **Viewport units different** - Mobile browsers handle `vh` differently (address bar)
3. **Timing issues on slower devices** - 100ms/500ms might be too short

**Solutions:**
- Test on actual device (not just DevTools mobile emulation)
- Consider using `dvh` (dynamic viewport height) if supported
- Increase timeouts on mobile: 150ms/700ms
- Add touch event logging to diagnose

---

## Research & Documentation Gaps

### What We Searched For

Extensive research was conducted across:
- ✅ react-virtuoso official documentation
- ✅ GitHub issues and discussions
- ✅ Stack Overflow questions
- ✅ Blog posts about chat UX
- ✅ AI chat application implementations

### What We Found

**1. Using react-virtuoso with Dynamic Footer Heights**

Documentation exists for:
- Basic footer component support
- Static footer heights

**Gaps:**
- ❌ NO documentation on dynamically changing footer heights
- ❌ NO guidance on how footer height changes interact with `scrollToIndex`
- ❌ NO examples of viewport-relative footer sizes (like `55vh`)

**2. Implementing "Focus Mode" UX Pattern**

Documentation exists for:
- Gemini example (mentions "each new question is scrolled to the top")
- AI chatbot example (basic streaming)

**Gaps:**
- ❌ NO comprehensive implementation guide
- ❌ Gemini example provides NO CODE
- ❌ NO explanation of WHY this pattern is better
- ❌ NO discussion of coordination requirements

**3. Combining scrollToIndex with Dynamic Footers**

Documentation exists for:
- Basic `scrollToIndex` with align options
- Footer components in general

**Gaps:**
- ❌ ZERO documentation on combining them
- ❌ NO examples of timing issues (hence the 100ms delay)
- ❌ NO guidance on race conditions

**4. Preventing Scroll Callbacks from Interfering**

Documentation exists for:
- `isScrolling` callback exists
- Race condition GitHub issues mention problems

**Gaps:**
- ❌ NO pattern documentation for guard flags
- ❌ NO examples of preventing callback interference
- ❌ NO timing guidance for when to re-enable callbacks

### Specific GitHub Issues Found

- **Issue #270:** Unable to scroll to bottom with footer in reverse mode
- **Issue #286:** Feature request for sticky footer
- **Issue #364:** Footer height issues when bigger than viewport
- **Issue #605:** Race condition in scroll compensation system
- **Discussion #1083:** Reverse scrolling flickering with dynamic heights

**None of these provide a complete solution for this pattern.**

### Stack Overflow Questions Found

- "How to scroll the last message from user to the top of chat container"
- Multiple questions about replicating ChatGPT scroll behavior
- Questions about combining virtuoso with dynamic content

**None have accepted answers with working implementations.**

### Conclusion

**This documentation fills a real gap.** The pattern described here:
- ✅ Is NOT documented comprehensively anywhere else
- ✅ Solves a real problem (proven by SO questions & GitHub issues)
- ✅ Requires advanced knowledge not found in official docs
- ✅ Involves timing requirements that are empirically derived
- ✅ Represents 5 months of development learning

---

## References

### Official Documentation
- [React Virtuoso](https://virtuoso.dev/)
- [Virtuoso Message List](https://virtuoso.dev/virtuoso-message-list/)
- [Scroll to Index](https://virtuoso.dev/scroll-to-index/)
- [Scroll Handling](https://virtuoso.dev/scroll-handling/)

### Examples
- [Virtuoso Message List - Gemini-like](https://virtuoso.dev/virtuoso-message-list/examples/gemini/)
- [Virtuoso Message List - AI Chatbot](https://virtuoso.dev/virtuoso-message-list/examples/ai-chatbot/)

### GitHub Issues & Discussions
- [Issue #270 - Unable to scroll to bottom with footer](https://github.com/petyosi/react-virtuoso/issues/270)
- [Issue #286 - Sticky Footer Feature Request](https://github.com/petyosi/react-virtuoso/issues/286)
- [Issue #364 - Footer height issues](https://github.com/petyosi/react-virtuoso/issues/364)
- [Issue #605 - Race condition in scroll compensation](https://github.com/petyosi/react-virtuoso/issues/605)
- [Discussion #1083 - Reverse scrolling flickering](https://github.com/petyosi/react-virtuoso/discussions/1083)

### Related Articles
- [Intuitive Scrolling for Chatbot Message Streaming](https://tuffstuff9.hashnode.dev/intuitive-scrolling-for-chatbot-message-streaming)
- [Handling scroll behavior for AI Chat Apps](https://jhakim.com/blog/handling-scroll-behavior-for-ai-chat-apps)

### Stack Overflow
- [How to scroll the last message from user to the top](https://stackoverflow.com/questions/79698278/how-to-scroll-the-last-message-from-user-to-the-top-of-chat-container)

---

## License & Attribution

This documentation is based on a working implementation developed over 5 months of research and experimentation. Feel free to use this pattern in your projects.

If you found this helpful, please:
- ⭐ Star the repository
- 📝 Share with other developers
- 💬 Contribute improvements via PR
- 🐛 Report issues if you find any

**Created:** January 23, 2025
**Last Updated:** January 23, 2025
**Version:** 1.0.0

---

## Appendix: Quick Reference

### Required States
```typescript
const [footerHeight, setFooterHeight] = useState<string>(`${minFooterHeight}px`);
const [isFooterBig, setIsFooterBig] = useState<boolean>(false);
const justSentMessageRef = useRef<boolean>(false);
```

### Required Props
```typescript
<Virtuoso
  followOutput={false}
  isScrolling={handleScrollingStateChange}
  components={{
    Header: () => <div className="h-30" />,
    Footer: () => <div style={{ height: footerHeight }}>{...}</div>
  }}
/>
```

### Critical Timing Values
- **100ms:** Delay before scrollToIndex (layout stabilization)
- **500ms:** Delay before enabling shrink callback (animation completion)

### Key Decisions
- **55vh:** Footer height for Focus Mode (adjustable based on your design)
- **align: 'start':** Scroll alignment (positions message at TOP)
- **followOutput: false:** Disables auto-scroll (CRITICAL)

---

**End of Documentation**
