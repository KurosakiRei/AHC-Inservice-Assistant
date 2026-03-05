# Epic: Inservice Assistant Automation

## Overview
Always Home Care requires caregiving staff to complete a mandatory 10-chapter Inservice training ("居家健康照护中的肯定性护理导论" and related modules) hosted on Reach360. This training involves watching numerous videos and answering knowledge check quizzes. The process is lengthy and tedious. 

This epic outlines the development of a Tampermonkey userscript that will fully automate the completion of this training. 

## Goals
1. **Reduce Time Spent:** Accelerate video playback to the maximum supported speed (16x).
2. **Eliminate Manual Action:** Automatically progress through the course by clicking "Continue/继续" buttons as they become available.
3. **Automate Quizzes:** Read quiz questions and automatically select the correct answers from a predefined dictionary built from the provided English and Chinese answer sheets.
4. **Prevent Interference:** Block accidental user interactions during automation.

## Core Features & Requirements

### 1. Detection & Initialization
- The script must detect when the user navigates to the Reach360 training URL (`https://always-home-care-6858.reach360.com/learn/course/*`).
- Upon detection, a Top-Right prompt or a Centered Modal must appear, indicating that the "Inservice Training" has been detected and offering a **"Start"** button to begin automation.

### 2. UI & User Experience (Protective Overlay)
- Once the "Start" button is clicked, the script must render a **frosted white glass backdrop** (`backdrop-filter: blur()`) over the entire webpage (excluding the script's own status dialog).
- This mask serves to prevent the user from clicking around and accidentally interrupting the script's execution flow.
- A central status panel must be displayed, continuously updating with the current action (e.g., "Progress: Chapter 1/10", "Action: Speeding up video 16x", "Action: Answering Quiz").

### 3. Video Automation Engine
- The script must actively search for instantiated `<video>` elements.
- For any playing or paused video, the script must forcefully set `video.playbackRate = 16.0`.
- The script should ensure the video plays until the `ended` event fires.

### 4. Progression Automation
- Reach360 uses "Continue" blocks to gate progression. Before the video finishes, these may say "Complete the content above before moving on".
- The script must monitor the DOM for the appearance of the clickable "Continue" (or "继续") buttons and automatically dispatch click events to them to advance to the next content block or lesson.

### 5. Quiz Automation 
- Reach360 lessons contain knowledge checks.
- The script must extract the text of the current question being asked on the screen.
- The script will utilize a hardcoded local dictionary containing all Q&A pairs from the 2026 Inservice Answer Keys (`Always Home Care In Service A 2026.md` and `Always Home Care 在职培训 A 2026.md`).
- It must find the radio button or checkbox label that matches the correct answer and click it.
- Finally, it must locate and click the "Submit" / "提交" button.

### 6. Robustness Details
- The script must be resilient to Reach360's SPA (Single Page Application) navigation within the iframe (`/frame/learn/...`).
- It must handle slight delays (e.g., using MutationObservers or interval polling) as elements fade in and out.

## Out of Scope
- Automating other courses not explicitly covered by the 2026 answer key.
- Bypassing server-side validation if Reach360 enforces a minimum total time spent on the backend (though 16x video playback is usually client-side).

## Implementation Milestones
- [x] Analyze requirements & Reach360 structure.
- [ ] Build the structural boilerplate (Userscript metadata, overlay UI).
- [ ] Parse and embed the bilingual Answer Dictionary.
- [ ] Implement the core Loop: Video acceleration & Auto-continue.
- [ ] Implement Quiz interaction logic.
- [ ] Test in the live environment (Chrome Canary).
