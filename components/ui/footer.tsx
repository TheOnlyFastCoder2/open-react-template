import Logo from './logo';
import Image from 'next/image';
import FooterIllustration from '@/public/images/footer-illustration.svg';
import { animLogo } from '@/app/animations';
import { Spring } from '@/utils/stm/react/animation/Spring';
import React from 'react';

// ---------- DATA ----------

type FooterLink = { label: string; href: string };
type FooterSection = { title: string; links: FooterLink[] };

const FOOTER_SECTIONS: FooterSection[] = [
  {
    title: 'Product',
    links: [
      { label: 'Features', href: '#0' },
      { label: 'Integrations', href: '#0' },
      { label: 'Pricing & Plans', href: '#0' },
      { label: 'Changelog', href: '#0' },
      { label: 'Our method', href: '#0' },
      { label: 'User policy', href: '#0' },
    ],
  },
  {
    title: 'Company',
    links: [
      { label: 'About us', href: '#0' },
      { label: 'Diversity & Inclusion', href: '#0' },
      { label: 'Blog', href: '#0' },
      { label: 'Careers', href: '#0' },
      { label: 'Financial statements', href: '#0' },
    ],
  },
  {
    title: 'Resources',
    links: [
      { label: 'Community', href: '#0' },
      { label: 'Terms of service', href: '#0' },
      { label: 'Report a vulnerability', href: '#0' },
    ],
  },
  {
    title: 'Content Library',
    links: [
      { label: 'Templates', href: '#0' },
      { label: 'Tutorials', href: '#0' },
      { label: 'Knowledge base', href: '#0' },
      { label: 'Learn', href: '#0' },
      { label: 'Cookie manager', href: '#0' },
    ],
  },
];

// SVG-иконки как функции, чтобы удобно реюзать
type IconProps = React.SVGProps<SVGSVGElement>;
const IconTwitter = (props: IconProps) => (
  <svg viewBox="0 0 32 32" aria-hidden="true" {...props}>
    <path d="m13.063 9 3.495 4.475L20.601 9h2.454l-5.359 5.931L24 23h-4.938l-3.866-4.893L10.771 23H8.316l5.735-6.342L8 9h5.063Zm-.74 1.347h-1.457l8.875 11.232h1.36l-8.778-11.232Z" />
  </svg>
);
const IconMedium = (props: IconProps) => (
  <svg viewBox="0 0 32 32" aria-hidden="true" {...props}>
    <path d="M23 8H9a1 1 0 0 0-1 1v14a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1V9a1 1 0 0 0-1-1Zm-1.708 3.791-.858.823a.251.251 0 0 0-.1.241V18.9a.251.251 0 0 0 .1.241l.838.823v.181h-4.215v-.181l.868-.843c.085-.085.085-.11.085-.241v-4.887l-2.41 6.131h-.329l-2.81-6.13V18.1a.567.567 0 0 0 .156.472l1.129 1.37v.181h-3.2v-.181l1.129-1.37a.547.547 0 0 0 .146-.472v-4.749a.416.416 0 0 0-.138-.351l-1-1.209v-.181H13.8l2.4 5.283 2.122-5.283h2.971l-.001.181Z" />
  </svg>
);
const IconGithub = (props: IconProps) => (
  <svg viewBox="0 0 32 32" aria-hidden="true" {...props}>
    <path d="M16 8.2c-4.4 0-8 3.6-8 8 0 3.5 2.3 6.5 5.5 7.6.4.1.5-.2.5-.4V22c-2.2.5-2.7-1-2.7-1-.4-.9-.9-1.2-.9-1.2-.7-.5.1-.5.1-.5.8.1 1.2.8 1.2.8.7 1.3 1.9.9 2.3.7.1-.5.3-.9.5-1.1-1.8-.2-3.6-.9-3.6-4 0-.9.3-1.6.8-2.1-.1-.2-.4-1 .1-2.1 0 0 .7-.2 2.2.8.6-.2 1.3-.3 2-.3s1.4.1 2 .3c1.5-1 2.2-.8 2.2-.8.4 1.1.2 1.9.1 2.1.5.6.8 1.3.8 2.1 0 3.1-1.9 3.7-3.7 3.9.3.4.6.9.6 1.6v2.2c0 .2.1.5.6.4 3.2-1.1 5.5-4.1 5.5-7.6-.1-4.4-3.7-8-8.1-8z" />
  </svg>
);

type Social = { label: string; href: string; Icon: (p: IconProps) => React.JSX.Element };
const SOCIALS: Social[] = [
  { label: 'Twitter', href: '#0', Icon: IconTwitter },
  { label: 'Medium', href: '#0', Icon: IconMedium },
  { label: 'Github', href: '#0', Icon: IconGithub },
];

// ---------- SPRING PRESETS (необязательные, для читаемости) ----------

const ILLUSTRATION_SPRING = {
  visibility: { enterAt: [[0, 1]] as [number, number][] },
  spring: {
    scale: { values: { default: 1.2, active: 1 }, stiffness: 20, damping: 4 },
    translateY: { values: { default: 100, active: 1 }, stiffness: 20, damping: 20 },
  },
} as const;

// ---------- COMPONENT ----------

export default function Footer() {
  return (
    <footer>
      <div className="relative mx-auto max-w-6xl px-4 sm:px-6">
        {/* Footer illustration */}
        <div className="pointer-events-none absolute bottom-0 left-1/2 -z-10 -translate-x-1/2" aria-hidden="true">
          <Spring {...ILLUSTRATION_SPRING}>
            <Image
              className="max-w-none"
              src={FooterIllustration}
              width={1076}
              height={378}
              alt="Footer illustration"
            />
          </Spring>
        </div>

        <div className="grid grid-cols-2 justify-between gap-12 py-8 sm:grid-rows-[auto_auto] md:grid-cols-4 md:grid-rows-[auto_auto] md:py-12 lg:grid-cols-[repeat(4,minmax(0,140px))_1fr] lg:grid-rows-1 xl:gap-20">
          {/* секции */}
          {FOOTER_SECTIONS.map((section) => (
            <div key={section.title} className="space-y-2">
              <h3 className="text-sm font-medium text-gray-200">{section.title}</h3>
              <ul className="space-y-2 text-sm">
                {section.links.map((l) => (
                  <li key={l.label} className="text-indigo-200/65 transition hover:text-indigo-500 active:text-indigo-500 " >
                    <Spring
                      triggers={['hover', 'down', 'enter']}
                      spring={{
                        scale: { values: { default: 1, down: 0.9, enter: 1.05 } },
                        rotate: { values: { default: 0, down: -5, enter: 3 } },
                      }} 
                    >
                      <a href={l.href}>
                        {l.label}
                      </a>
                    </Spring>
                  </li>
                ))}
              </ul>
            </div>
          ))}

          {/* логотип + соцсети */}
          <div className="col-span-2 md:col-span-4 lg:col-span-1 lg:text-right">
            <div className="mb-3 ml-auto flex w-fit flex-1">
              <Spring {...animLogo}>
                <Logo />
              </Spring>
            </div>
            <div className="text-sm">
              <p className="mb-3 text-indigo-200/65">
                © Cruip.com
                <span className="text-gray-700"> · </span>
                <a className="text-indigo-200/65 transition hover:text-indigo-500" href="#0">
                  Terms
                </a>
              </p>
              <ul className="inline-flex gap-1">
                {SOCIALS.map(({ label, href, Icon }) => (
                  <li key={label}>
                    <Spring {...animLogo}>
                      <a
                        className="flex items-center justify-center text-indigo-500 transition hover:text-indigo-400"
                        href={href}
                        aria-label={label}
                        title={label}
                      >
                        <Icon className="h-8 w-8 fill-current" />
                      </a>
                    </Spring>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
