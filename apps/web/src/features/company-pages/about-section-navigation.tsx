'use client';

import { useCallback, useEffect, useState, type MouseEvent } from 'react';
import { getScrollBehavior, usePrefersReducedMotion } from '@/lib/use-media-query';

type AboutSection = Readonly<{
  id: string;
  label: string;
}>;

type AboutSectionNavigationProps = {
  sections: readonly AboutSection[];
};

/** 회사 소개 목차의 현재 섹션을 스크롤·해시와 동기화합니다. */
export function AboutSectionNavigation({ sections }: AboutSectionNavigationProps) {
  const [activeSectionId, setActiveSectionId] = useState(sections[0]?.id ?? '');
  const prefersReducedMotion = usePrefersReducedMotion();

  const updateActiveSectionFromScroll = useCallback(() => {
    const activationOffset = 144;
    const currentSection = [...sections].reverse().find((section) => {
      const target = document.getElementById(section.id);
      return target && target.getBoundingClientRect().top <= activationOffset;
    });

    setActiveSectionId(currentSection?.id ?? sections[0]?.id ?? '');
  }, [sections]);

  useEffect(() => {
    let scheduledFrame = 0;

    const syncWithHash = () => {
      const hashSectionId = window.location.hash.slice(1);
      const sectionExists = sections.some((section) => section.id === hashSectionId);

      if (sectionExists) {
        setActiveSectionId(hashSectionId);
      } else {
        updateActiveSectionFromScroll();
      }
    };

    const scheduleScrollUpdate = () => {
      if (scheduledFrame) return;

      scheduledFrame = window.requestAnimationFrame(() => {
        scheduledFrame = 0;
        updateActiveSectionFromScroll();
      });
    };

    syncWithHash();
    window.addEventListener('scroll', scheduleScrollUpdate, { passive: true });
    window.addEventListener('resize', scheduleScrollUpdate);
    window.addEventListener('hashchange', syncWithHash);
    window.addEventListener('popstate', syncWithHash);

    return () => {
      window.removeEventListener('scroll', scheduleScrollUpdate);
      window.removeEventListener('resize', scheduleScrollUpdate);
      window.removeEventListener('hashchange', syncWithHash);
      window.removeEventListener('popstate', syncWithHash);
      if (scheduledFrame) window.cancelAnimationFrame(scheduledFrame);
    };
  }, [sections, updateActiveSectionFromScroll]);

  const handleSectionClick = (event: MouseEvent<HTMLAnchorElement>, sectionId: string) => {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
      return;
    }

    const target = document.getElementById(sectionId);
    if (!target) return;

    event.preventDefault();
    const hash = `#${sectionId}`;
    if (window.location.hash !== hash) window.history.pushState(null, '', hash);

    setActiveSectionId(sectionId);
    target.focus({ preventScroll: true });
    target.scrollIntoView({
      behavior: getScrollBehavior(prefersReducedMotion),
      block: 'start',
    });
  };

  return (
    <nav aria-label="회사소개 목차" className="border-b border-line">
      <div className="mx-auto w-full max-w-[calc(var(--container-web)+40px)] px-16 sm:px-20">
        <div className="flex w-full flex-wrap items-center lg:flex-nowrap">
          {sections.map((section) => {
            const isActive = activeSectionId === section.id;

            return (
              <a
                key={section.id}
                href={`#${section.id}`}
                aria-current={isActive ? 'location' : undefined}
                onClick={(event) => handleSectionClick(event, section.id)}
                className={`inline-flex h-56 shrink-0 items-center border-b-2 px-12 text-label-m focus-ring lg:px-24 ${
                  isActive
                    ? 'border-text-1 text-text-1'
                    : 'border-transparent text-text-3 hover:text-text-1'
                }`}
              >
                {section.label}
              </a>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
