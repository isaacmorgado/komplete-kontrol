# RE System Quick Start Guide

**Last Updated:** January 18, 2026
**Status:** Phase 2 Complete - Ready for Testing

---

## 🚀 Quick Setup (5 minutes)

### 1. Seed the RE Database
```bash
cd komplete-kontrol/src/main/re
npx ts-node seed-database.ts
```

This populates the database with:
- 12 essential RE tools (Ghidra, APKTool, Frida, mitmproxy, etc.)
- 6 pre-built workflows (Android APK, binary malware, API recon, etc.)

### 2. Install Example Tools (Optional)
```bash
# Android APK analysis
brew install apktool

# Network analysis
brew install mitmproxy

# Binary analysis (requires GUI)
# Download Ghidra from https://ghidra-sre.org
```

### 3. Launch Development Build
```bash
npm run dev
```

---

## 📖 Using the RE System

### Basic Usage

1. **Open RE Panel** (in the UI)
2. **Type a command:**
   ```
   reverse engineer myapp.apk
   ```
3. **Review the intent:**
   - Target type: `mobile-app`
   - Confidence: `92%`
   - Depth: `moderate`
4. **Click "Analyze"**
5. **Select tools/workflow:**
   - Automated: "Android APK Analysis" workflow
   - Manual: APKTool + Frida + MobSF
6. **Execute and monitor:**
   - Real-time progress
   - Step-by-step output
   - Completion status

---

## 🎯 Example Commands

### Mobile Apps
```
reverse engineer instagram.apk
analyze android app reddit.apk
decompile ios app telegram.ipa
```

### Binaries
```
reverse engineer malware.exe
analyze binary suspicious.dll
disassemble linux binary /usr/bin/nginx
```

### Web Apps
```
reverse engineer example.com
analyze web app https://target.com
scrape javascript from app.js
```

### APIs
```
reverse engineer api.example.com
analyze rest api https://api.github.com
test api endpoints http://localhost:3000
```

### Firmware
```
reverse engineer router.bin
analyze firmware esp32_v1.2.bin
extract firmware netgear_r7000.img
```

### Cloud/Containers
```
reverse engineer docker image nginx:latest
scan container vulnerabilities myapp:v1.0
analyze cloud service s3://mybucket
```

---

## 🧩 Component API

### RECommandPanel
```tsx
import { RECommandPanel } from '@/components/RE';

<RECommandPanel
  theme={theme}
  onCommandSubmit={(command) => {
    // User submitted command
    console.log('Command:', command);
  }}
  isProcessing={false}
/>
```

**Props:**
- `theme: Theme` - Maestro theme object
- `onCommandSubmit: (command: string) => void` - Callback when command submitted
- `isProcessing?: boolean` - Disable input during execution

### ToolSelector
```tsx
import { ToolSelector } from '@/components/RE';

<ToolSelector
  theme={theme}
  intent={parsedIntent}
  onToolsSelected={(selection) => {
    // User selected tools/workflow
    console.log('Selection:', selection);
  }}
/>
```

**Props:**
- `theme: Theme` - Maestro theme object
- `intent: any` - Parsed intent from RECommandPanel
- `onToolsSelected: (selection: any) => void` - Callback when tools selected

### ExecutionMonitor
```tsx
import { ExecutionMonitor } from '@/components/RE';

<ExecutionMonitor
  theme={theme}
  executionId="exec_123456"
  onCancel={() => {
    // User cancelled execution
    console.log('Cancelled');
  }}
/>
```

**Props:**
- `theme: Theme` - Maestro theme object
- `executionId: string` - Execution ID from orchestrator
- `onCancel?: () => void` - Optional callback when cancelled

---

## 🔌 IPC API Reference

### Command Parsing
```typescript
// Parse natural language command
const result = await window.maestro.re.parseCommand('reverse engineer app.apk');

if (result.success) {
  console.log('Intent:', result.data);
  // {
  //   command: 're',
  //   target: { type: 'mobile-app', path: 'app.apk' },
  //   options: { depth: 'moderate', parallel: true },
  //   confidence: 0.92
  // }
}
```

### Tool Selection
```typescript
// Get tool recommendations
const result = await window.maestro.re.selectTools(intent);

if (result.success) {
  console.log('Tools:', result.data.primaryTools);
  console.log('Workflows:', result.data.workflows);
  console.log('Recommended:', result.data.recommendedApproach);
}
```

### Execution
```typescript
// Create execution plan
const planResult = await window.maestro.re.plan('reverse engineer app.apk');
const plan = planResult.data;

// Execute plan
const execResult = await window.maestro.re.execute(plan);
const executionId = execResult.data.executionId;

// Monitor execution
const statusResult = await window.maestro.re.getStatus(executionId);
console.log('Status:', statusResult.data.status);
console.log('Progress:', statusResult.data.progress + '%');

// Cancel if needed
await window.maestro.re.cancel(executionId);
```

### Event Listeners
```typescript
// Listen to execution events
const unsubscribe = window.maestro.re.onExecutionStart((id, plan) => {
  console.log('Execution started:', id);
});

const unsubStep = window.maestro.re.onStepProgress((id, stepIndex, output) => {
  console.log(`Step ${stepIndex} output:`, output);
});

// Cleanup on unmount
useEffect(() => {
  return () => {
    unsubscribe();
    unsubStep();
  };
}, []);
```

### Database Queries
```typescript
// List all tools
const tools = await window.maestro.re.listTools();

// Get specific tool
const tool = await window.maestro.re.getTool('apktool');

// List workflows
const workflows = await window.maestro.re.listWorkflows({
  target_type: 'mobile-app'
});

// Check tool availability
const availability = await window.maestro.re.checkToolAvailability([
  'apktool', 'frida', 'ghidra'
]);
console.log('Installed:', availability.data.available);
console.log('Missing:', availability.data.missing);
```

---

## 🧪 Testing Workflows

### Test 1: APK Analysis (5 minutes)
```bash
# 1. Ensure APKTool is installed
brew install apktool

# 2. Download test APK
curl -o test.apk https://example.com/test.apk

# 3. In the UI, type:
reverse engineer test.apk

# 4. Select "Android APK Analysis" workflow

# 5. Execute and verify:
# - APKTool decompilation runs
# - Output shows XML, Java sources extracted
# - Completion within 2-3 minutes
```

### Test 2: Binary Analysis (10 minutes)
```bash
# 1. Install Ghidra (GUI required)
# Download from https://ghidra-sre.org

# 2. Find test binary
ls /usr/bin/ls

# 3. In the UI, type:
reverse engineer /usr/bin/ls

# 4. Select manual tools: Ghidra

# 5. Execute and verify:
# - Ghidra analysis runs
# - Disassembly output generated
```

### Test 3: Web Scraping (3 minutes)
```bash
# 1. Ensure you have internet access

# 2. In the UI, type:
reverse engineer example.com

# 3. Select "Web App Analysis" workflow

# 4. Execute and verify:
# - Playwright scrapes page
# - HTML, JS, CSS extracted
# - Completion within 1-2 minutes
```

---

## 🐛 Troubleshooting

### Issue: "No tools found"
**Solution:** Seed the database:
```bash
cd src/main/re
npx ts-node seed-database.ts
```

### Issue: "Tool not available"
**Solution:** Install the tool (check installation command in UI)
```bash
# Example for APKTool
brew install apktool
```

### Issue: "Low confidence parsing"
**Solution:** Be more specific:
- Bad: "analyze app"
- Good: "reverse engineer myapp.apk"

### Issue: "Execution timeout"
**Solution:** Increase timeout in orchestrator.ts:
```typescript
timeout: 120000, // 2 minutes instead of 60s
```

### Issue: "Output buffer exceeded"
**Solution:** Increase maxBuffer in orchestrator.ts:
```typescript
maxBuffer: 20 * 1024 * 1024 // 20MB instead of 10MB
```

---

## 📚 Architecture Overview

```
User Input
  ↓
RECommandPanel (React)
  ↓
window.maestro.re.parseCommand() (IPC)
  ↓
IntentParser (Backend)
  ↓
ToolSelector (Backend)
  ↓
REOrchestrator.plan() (Backend)
  ↓
REOrchestrator.execute() (Backend)
  ↓
child_process.exec() (Tool execution)
  ↓
Real-time events via IPC
  ↓
ExecutionMonitor (React)
  ↓
Results displayed to user
```

---

## 📖 Further Reading

- **Phase 1 Summary:** `RE-PHASE-1-IMPLEMENTATION-SUMMARY.md`
- **Phase 2 Summary:** `RE-PHASE-2-UI-INTEGRATION-COMPLETE.md`
- **Architecture:** `RE-INTEGRATION-ARCHITECTURE.md`
- **Implementation Guide:** `IMPLEMENTATION-QUICKSTART.md`
- **Workflows:** `~/.claude/docs/REVERSE-ENGINEERING-WORKFLOWS.md`

---

## 🎉 You're Ready!

The RE system is now fully integrated and ready for testing. Start with simple commands and gradually explore more complex workflows.

**Happy Reverse Engineering!** 🔍
