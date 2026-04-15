import { QA_DICT } from "./QA_DICT";

export class AutomationEngine {
  private automationInterval: any = null;
  private isAutomating: boolean = false;
  private onLog: (msg: string) => void;

  constructor(onLog: (msg: string) => void) {
    this.onLog = onLog;
  }

  public setAutomating(status: boolean) {
    this.isAutomating = status;
    if (status) {
      if (!this.automationInterval) {
        this.startEngine();
      }
    }
  }

  private logStatus(msg: string) {
    console.log("[Inservice Assistant]", msg);
    this.onLog(msg);
  }

  private startEngine() {
    this.automationInterval = setInterval(() => {
      if (!this.isAutomating) return;
      if (document.readyState !== "complete") return;
      this.executeAutomationStep();
    }, 2000);
  }

  private getDocScope(): Document {
    let docScope = document;
    if (window.top !== window.self) return docScope;

    // Find the Reach360 content iframe by checking for a meaningful title.
    // document.querySelector("iframe") returns the first iframe which is always
    // a blank placeholder; the actual content is in a later iframe.
    const iframes = Array.from(document.querySelectorAll("iframe"));
    const reach360Iframe = iframes.find((f) => {
      try {
        const src = f.src || "";
        if (src.includes("reach360.com/frame/learn")) return true;
        // Fallback: any same-origin iframe that has a real document title
        return !!f.contentDocument?.title && f.contentDocument.title.length > 5;
      } catch (e) {
        return false;
      }
    });

    if (reach360Iframe?.contentDocument) {
      docScope = reach360Iframe.contentDocument;
    }
    return docScope;
  }

  private executeAutomationStep() {
    const docScope = this.getDocScope();

    // === COMPLETION DETECTION: stop if on the progress-summary / 恭喜 page ===
    const url = window.location.href;
    if (
      url.includes("progress-summary") ||
      document.body.innerText.includes("恭喜")
    ) {
      this.isAutomating = false;
      if (this.automationInterval) {
        clearInterval(this.automationInterval);
        this.automationInterval = null;
      }
      // Also clear sessionStorage so auto-start doesn't happen on next load
      try {
        sessionStorage.removeItem("ia_automating");
      } catch (e) {}
      this.logStatus("🎉 Course complete! Automation stopped.");
      return;
    }

    // === STEP 1: Try to answer quiz questions (bottom-first) ===
    if (this.tryAnswerQuiz(docScope)) return;

    // === STEP 2: Submit answered quizzes ===
    if (this.trySubmitQuiz(docScope)) return;

    // === STEP 3: Click "Continue" / "Next" / lesson navigation banners ===
    // This runs BEFORE video handling, so a playing video doesn't block navigation.
    if (this.tryClickContinue(docScope)) return;

    // === STEP 4: Handle videos — only intervene if paused/unstarted ===
    this.tryPlayVideo(docScope);
  }

  /**
   * Find visible submit buttons and click them.
   * This is dead simple: find all buttons with "提交"/"submit",
   * check if it's visible and not disabled, and click it.
   * Returns true if a submit was attempted.
   */
  private trySubmitQuiz(doc: Document): boolean {
    const allBtns = Array.from(doc.querySelectorAll("button"));

    // Work from bottom up (reverse order in DOM = bottom of page first)
    for (let i = allBtns.length - 1; i >= 0; i--) {
      const btn = allBtns[i];
      const text = (btn.textContent || "").trim().toLowerCase();

      if (!(text === "提交" || text === "submit" || text === "submit answer"))
        continue;
      if (btn.disabled) continue;

      // Visibility checks
      const rect = btn.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) continue;
      if (btn.offsetParent === null) continue;

      // CRITICAL GUARD: Only click submit if there is actually a checked answer
      const container = btn.closest(
        ".quiz-card, .block-knowledge-check, section"
      );
      if (!container) continue;
      const hasChecked = container.querySelector(
        'input[type="radio"]:checked, input[type="checkbox"]:checked'
      );
      if (!hasChecked) continue; // No answer selected — don't submit

      // The button is visible, enabled, has a selected answer — click it
      btn.scrollIntoView({ behavior: "smooth", block: "center" });
      setTimeout(() => {
        btn.click();
        this.logStatus("Submitted answer.");
      }, 300);
      return true;
    }
    return false;
  }

  /**
   * Try to answer quiz questions. Scan from the bottom of the page.
   * The question text is always in .quiz-card__title inside a .quiz-card element.
   */
  private tryAnswerQuiz(doc: Document): boolean {
    const questionElements = Array.from(
      doc.querySelectorAll(
        ".quiz-card__title, .quiz-question-text, legend, .question-text"
      )
    );

    // Process from bottom up
    for (let i = questionElements.length - 1; i >= 0; i--) {
      const qEl = questionElements[i];

      // VISIBILITY CHECK: Skip hidden questions from other chapters/sections
      const rect = qEl.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) continue;

      const qText = (qEl.textContent || "").trim();
      if (qText.length < 5) continue;

      const foundEntry = QA_DICT.find((entry) => qText.includes(entry.q));
      if (!foundEntry) continue;

      const expectedAnswers = Array.isArray(foundEntry.a)
        ? foundEntry.a
        : [foundEntry.a];

      // Find the closest quiz card container for this question
      const card = qEl.closest(
        ".quiz-card, .block-knowledge-check, section, .blocks-lesson"
      ) as HTMLElement | null;
      if (!card) continue;

      // Skip if this card already has the retake button visibly shown.
      // Reach360 pre-renders the retake button in the DOM with opacity:0 (inside a
      // max-height:0 container with overflow:visible), so getBoundingClientRect
      // returns height=32 even BEFORE the card is submitted. We must also check
      // computed opacity to confirm the button is actually visible to the user.
      const retakeBtn = card.querySelector(
        ".block-knowledge__retake"
      ) as HTMLElement | null;
      if (retakeBtn && retakeBtn.getBoundingClientRect().height > 0) {
        const cardWin = doc.defaultView || window;
        const retakeOpacity = parseFloat(
          cardWin.getComputedStyle(retakeBtn).opacity
        );
        if (retakeOpacity > 0) {
          continue; // Submitted — retake button is actually visible (opacity > 0)
        }
      }

      // Get choices within this card only
      const choices = Array.from(
        card.querySelectorAll('input[type="radio"], input[type="checkbox"]')
      );
      let clickedAny = false;

      for (const input of choices) {
        const inputEl = input as HTMLInputElement;
        let label = inputEl.id
          ? doc.querySelector(`label[for="${inputEl.id}"]`)
          : null;
        if (!label) label = inputEl.closest("label");
        if (!label) continue;

        const labelText = (label.textContent || "").trim();
        for (const possibleAns of expectedAnswers) {
          const hasSelectedClass = Array.from(label.classList).some(
            (c) => c.includes("selected") || c.includes("checked")
          );
          // If native is checked but no visual class, Vue might be desynced, so we FORCE click anyway
          const needsClick =
            !inputEl.checked || (inputEl.checked && !hasSelectedClass);

          if (labelText.includes(possibleAns) && needsClick) {
            // Natively click ONLY the input to avoid double-toggling and bypass label event blockers
            inputEl.click();

            // Dispatch synthetic events just in case Vue needs them on the input
            inputEl.dispatchEvent(new Event("input", { bubbles: true }));
            inputEl.dispatchEvent(new Event("change", { bubbles: true }));

            clickedAny = true;
            this.logStatus(
              "Selected quiz answer: " + possibleAns.substring(0, 20) + "..."
            );
          }
        }
      }

      if (clickedAny) return true; // Let next interval handle the submit
    }
    return false;
  }

  /**
   * Manage video playback.
   * Only scrolls/intervenes when video is paused.
   * Does NOT return true when video is already playing —
   * that allows tryClickContinue to still run and advance the lesson.
   */
  private tryPlayVideo(doc: Document): boolean {
    const videos = Array.from(doc.querySelectorAll("video"));

    // === SIDEBAR COMPLETION CHECK ===
    // If the current lesson is marked complete in the sidebar, all its videos are done.
    // The sidebar is always in the main document (not iframe), so we check document.
    const currentLessonId =
      window.location.href.split("/lessons/")[1]?.split("?")[0] || "";
    // Sidebar is inside the iframe (doc), NOT in the main document.
    const sidebarItems = Array.from(
      doc.querySelectorAll(
        ".nav-sidebar__outline-item"
      ) as NodeListOf<HTMLElement>
    );
    const currentSidebarItem = sidebarItems.find((item) => {
      const href = item.querySelector("a")?.getAttribute("href") || "";
      return href.includes(currentLessonId);
    });
    const currentLessonComplete =
      currentSidebarItem?.classList.contains(
        "nav-sidebar__outline-item--complete"
      ) ?? false;

    if (currentLessonComplete) {
      // Mark all videos on this page as done — sidebar says chapter is complete
      videos.forEach((v) => {
        v.dataset.iaCompleted = "true";
      });
      return false; // Let tryClickContinue advance to next lesson
    }

    // === LOCKED CONTINUE GUARD ===
    // If the platform's continue-hint is still locked AND a visible video is
    // marked iaCompleted with currentTime near 0 (platform reset it), but
    // the video has NEVER actually fired a full completion cycle,
    // reset the flag so we try replaying it.
    // We track completions via `iaPlayCount` — only reset if count is 0.
    const lockedHint = doc.querySelector(".continue-hint .fa-lock-keyhole");
    if (lockedHint) {
      const pendingUnwatched = videos.find((v) => {
        const rect = v.getBoundingClientRect();
        if (rect.width === 0 && rect.height === 0) return false;
        if (rect.bottom < 0) return false; // scrolled beyond top
        const playCount = parseInt(v.dataset.iaPlayCount || "0", 10);
        // Only reset if no successful play-through ever occurred
        return (
          v.dataset.iaCompleted === "true" &&
          !v.ended &&
          v.currentTime < 1 &&
          playCount < 1
        );
      });
      if (pendingUnwatched) {
        this.logStatus(
          "Platform locked — resetting never-played video to replay."
        );
        delete pendingUnwatched.dataset.iaCompleted;
        delete pendingUnwatched.dataset.iaTracked;
      }
    }

    for (let i = videos.length - 1; i >= 0; i--) {
      const video = videos[i];

      // Reset state if video source changes (SPA element recycling)
      // If the platform re-uses the same <video> element for a new chapter, we must reset our flags.
      if (video.dataset.iaSrc !== video.currentSrc) {
        delete video.dataset.iaCompleted;
        delete video.dataset.iaTracked;
        video.dataset.iaSrc = video.currentSrc;
      }

      // Attach tracking listeners if not already done
      if (!video.dataset.iaTracked) {
        video.dataset.iaTracked = "true";
        video.addEventListener("ended", () => {
          video.dataset.iaCompleted = "true";
          // Increment play count so the Locked Continue Guard won't reset this video again
          video.dataset.iaPlayCount = String(
            parseInt(video.dataset.iaPlayCount || "0", 10) + 1
          );
        });
        video.addEventListener("timeupdate", () => {
          if (video.duration > 0 && video.currentTime >= video.duration - 1) {
            video.dataset.iaCompleted = "true";
            if (
              !video.dataset.iaPlayCount ||
              video.dataset.iaPlayCount === "0"
            ) {
              video.dataset.iaPlayCount = "1";
            }
          }
        });
      }

      // Inline completion check (handles SPA re-created elements)
      if (video.duration > 0 && video.currentTime >= video.duration - 1) {
        video.dataset.iaCompleted = "true";
      }

      // Skip completed videos
      if (video.ended || video.dataset.iaCompleted === "true") {
        continue;
      }

      // Skip invisible videos (truly not rendered)
      const rect = video.getBoundingClientRect();
      if (rect.width === 0 && rect.height === 0) continue;

      // Skip videos that are far ABOVE the current scroll position.
      // These are from previous chapters that are still in the SPA DOM.
      // ONLY treat a video as done if it was actually played significantly
      // (currentTime > 80% of duration). Otherwise keep trying to play it.
      if (rect.bottom < -window.innerHeight) {
        const wasWatched =
          video.duration > 0 && video.currentTime >= video.duration * 0.8;
        if (wasWatched) {
          video.dataset.iaCompleted = "true";
        }
        continue;
      }

      // Ensure fast playback speed
      if (video.playbackRate !== 16.0) {
        video.playbackRate = 16.0;
        video.muted = true;
        this.logStatus("Speeding up video (16x)");
      }

      if (video.paused) {
        // Video is PAUSED: intervene, scroll to it, and resume
        video.muted = true;
        video.scrollIntoView({ behavior: "smooth", block: "center" });
        const p = video.play();
        if (p !== undefined) p.catch(() => {});
        this.logStatus("Resuming paused video (16x)");
        return true; // Block other steps while we restart the video
      } else {
        // Video is ALREADY PLAYING — don't block continue/next buttons
        this.logStatus(
          `Video playing (${Math.round(video.currentTime)}s / ${Math.round(
            video.duration
          )}s)`
        );
        return false; // Let tryClickContinue run normally
      }
    }
    // All videos on the page are done (completed or skipped).
    // Rise 360 lazy-renders content below the video (summary cards, continue button)
    // only when that content scrolls into view. We scroll to the bottom now to
    // trigger IntersectionObserver rendering so tryClickContinue can find the button.
    // NOTE: Reach360 sets html/body to overflow:hidden. The actual scroll container
    // is div.page-wrap inside the iframe — win.scrollTo() has no effect.
    const pageWrapEnd = doc.querySelector(".page-wrap") as HTMLElement | null;
    if (pageWrapEnd) {
      pageWrapEnd.scrollTo({
        top: pageWrapEnd.scrollHeight,
        behavior: "smooth",
      });
    }
    return false;
  }

  /**
   * Click continue/next buttons and lesson-nav banners.
   * Scans from bottom of page upward so we always catch the most recent actionable element.
   */
  private tryClickContinue(doc: Document): boolean {
    // === QUIZ PENDING GUARD ===
    // If any quiz card on the current page hasn't been submitted yet, block ALL
    // lesson-nav banner clicks. We detect submission by checking whether the
    // retake button (.block-knowledge__retake) is visible (height > 0). Reach360
    // always keeps .quiz-card__feedback at height:0 via CSS (even after submission),
    // so feedback height is never a reliable indicator.
    const quizCards = Array.from(doc.querySelectorAll(".quiz-card"));
    const hasPendingQuiz = quizCards.some((card) => {
      // A card is "done" when its retake button is visibly rendered (opacity > 0).
      // Reach360 pre-renders the retake button with opacity:0 before submission,
      // so we must check BOTH height > 0 AND opacity > 0.
      const retakeBtn = card.querySelector(
        ".block-knowledge__retake"
      ) as HTMLElement | null;
      if (retakeBtn && retakeBtn.getBoundingClientRect().height > 0) {
        const cardWin = doc.defaultView || window;
        const retakeOpacity = parseFloat(
          cardWin.getComputedStyle(retakeBtn).opacity
        );
        if (retakeOpacity > 0) return false; // Visibly done (submitted)
      }
      // A checked radio means the user selected an answer (submit step will follow)
      const hasChecked = card.querySelector(
        'input[type="radio"]:checked, input[type="checkbox"]:checked'
      );
      if (hasChecked) return false;
      return true; // Not yet submitted → pending
    });

    // === VIDEO PENDING GUARD ===
    // Block ALL "Continue" and lesson-nav banner clicks if there's any visible video
    // on the current page that hasn't finished playing yet.
    const videos = Array.from(doc.querySelectorAll("video"));
    const hasPendingVideo = videos.some((video) => {
      const rect = video.getBoundingClientRect();
      // Ignore invisible videos or ones scrolled far away
      if (rect.width === 0 && rect.height === 0) return false;
      if (rect.bottom < -window.innerHeight) return false;

      // If it's not completed natively or via our flag, it's pending
      return !video.ended && video.dataset.iaCompleted !== "true";
    });

    const candidates = Array.from(
      doc.querySelectorAll(
        'button, a, div[role="button"], .lesson-nav-link__link, .blocks-continue-btn'
      )
    );

    // Normal continue phrases — always allowed (with other guards)
    const continuePhrases = [
      "continue",
      "继续",
      "next",
      "下一步",
      "next lesson",
      "下一课",
      "start course",
      "开始课程",
      "开始测验",
    ];

    // Finish-only phrases — ONLY allowed when sidebar shows 100% completion.
    // These words may appear in quiz feedback or lesson content, so we guard them strictly.
    const finishOnlyPhrases = ["完成", "finish", "done"];

    // Check sidebar completion — sidebar lives inside the iframe (doc), not main document.
    const sidebarPercentEl = doc.querySelector(
      '.nav-sidebar-header__progress-text, .nav-sidebar__completion-percentage, [class*="percent"]'
    );
    const sidebarText = (sidebarPercentEl?.textContent || "").replace(
      /\s/g,
      ""
    );
    const courseIs100Pct =
      sidebarText.includes("100%") ||
      sidebarText.includes("已完成") ||
      (doc.querySelectorAll(".nav-sidebar__outline-item--complete").length >
        0 &&
        doc.querySelectorAll(
          ".nav-sidebar__outline-item:not(.nav-sidebar__outline-item--complete)"
        ).length === 0);

    // Process from bottom to top (last/newest element first)
    for (let i = candidates.length - 1; i >= 0; i--) {
      const btn = candidates[i];
      const text = (btn.textContent || "").trim().toLowerCase();
      const trimmedText = (btn.textContent || "").trim();

      const isRegularContinue =
        (continuePhrases.some((p) => text.includes(p)) && text.length < 40) ||
        btn.classList.contains("continue-btn") ||
        btn.classList.contains("blocks-continue-btn");

      // Finish-only: match ONLY if sidebar is at 100%, and text is short (a button, not body text)
      const isFinishBtn =
        courseIs100Pct &&
        finishOnlyPhrases.some(
          (p) => trimmedText === p || text === p.toLowerCase()
        ) &&
        text.length < 10;

      const isContinueBtn = isRegularContinue || isFinishBtn;

      const isLessonNavBanner =
        btn.classList.contains("lesson-nav-link__link") &&
        text.includes("课程");

      if (!isContinueBtn && !isLessonNavBanner) continue;

      // PREVENT infinite loop: do not click "previous chapter" links
      if (btn.closest(".lesson-nav--previous")) {
        continue;
      }

      // BLOCK lesson-nav banners from being clicked while quizzes are pending
      if (isLessonNavBanner && hasPendingQuiz) {
        this.logStatus("Quiz pending — blocking nav banner click.");
        return false;
      }

      // BLOCK all Continue clicks (both banners and inline buttons) if a video is pending
      if ((isLessonNavBanner || isContinueBtn) && hasPendingVideo) {
        this.logStatus("Video playing — blocking Continue/Nav click.");
        return false;
      }

      // Visibility check
      const style = window.getComputedStyle(btn);
      if (style.display === "none" || style.visibility === "hidden") continue;
      if ((btn as HTMLButtonElement).disabled) continue;

      const rect = btn.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) continue;

      // Scroll into view if needed, then click.
      // Use the iframe's own innerHeight for the comparison (not main window).
      const iframeInnerH = (doc.defaultView || window).innerHeight;
      if (rect.top > iframeInnerH || rect.bottom < 0) {
        btn.scrollIntoView({ behavior: "smooth", block: "center" });
      }
      (btn as HTMLElement).click();
      this.logStatus(
        `Clicked "${(btn.textContent || "").trim().substring(0, 20)}" button.`
      );

      // After clicking Continue, Rise 360 lazy-loads the next content section below.
      // Scroll div.page-wrap to bottom so newly rendered blocks enter the viewport.
      // NOTE: win.scrollTo() is a no-op here because Reach360 sets html/body to
      // overflow:hidden; the real scroll container is div.page-wrap.
      setTimeout(() => {
        const pageWrap = doc.querySelector(".page-wrap") as HTMLElement | null;
        if (pageWrap) {
          pageWrap.scrollTo({ top: pageWrap.scrollHeight, behavior: "smooth" });
        }
      }, 600);

      return true;
    }
    return false;
  }
}
