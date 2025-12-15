import VideoThumb from '@/public/images/hero-image-01.jpg';
import ModalVideo from '@/components/modal-video';
import { Spring } from '@/utils/stm/react/animation/Spring';
import { animButton, animButtonBig } from '@/app/animations';

export default function HeroHome() {
  return (
    <section>
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        {/* Hero content */}
        <div className="py-12 md:py-20">
          {/* Section header */}
          <div className="pb-12 text-center md:pb-20">
            <Spring
              visibility={{
                enterAt: [[0.05, 0.5]],
                delay: 500,
              }}
              spring={{
                opacity: { values: { default: 0, active: 1 }, stiffness: 100, damping: 20 },
                scale: { values: { default: 0, active: 1 }, stiffness: 140, damping: 70 },
              }}
            >
              <h1 className="animate-[gradient_6s_linear_infinite] bg-[linear-gradient(to_right,var(--color-gray-200),var(--color-indigo-200),var(--color-gray-50),var(--color-indigo-300),var(--color-gray-200))] bg-[length:200%_auto] bg-clip-text pb-5 font-nacelle text-4xl font-semibold text-transparent md:text-5xl">
                AI-driven tools for product teams
              </h1>
            </Spring>
            <div className="mx-auto max-w-3xl">
              <Spring
                visibility={{
                  enterAt: [[0.05, 0.5]],
                }}
                spring={{
                  opacity: {
                    values: { default: 0, active: 1 },
                    stiffness: 80,
                    damping: 18,
                  },
                  scale: {
                    values: { default: 0.8, active: 1.05, leave: 0.9 },
                    stiffness: 120,
                    damping: 70,
                  },
                  translateY: {
                    values: { default: 40, active: 0 },
                    stiffness: 120,
                    damping: 50,
                  },
                }}
              >
                <p className="mb-8 text-xl text-indigo-200/80 leading-relaxed tracking-wide">
                  Our landing page template works on all devices, so you only have to set it up once, and get beautiful
                  results forever.
                </p>
              </Spring>

              <div className="mx-auto max-w-xs sm:flex sm:max-w-none sm:justify-center">
                <div data-aos="fade-up" data-aos-delay={400}>
                  <Spring {...animButtonBig(93, 96, 227)} className="mb-4 rounded-md">
                    <span
      
                      className="btn group  w-full bg-linear-to-t from-indigo-600 to-indigo-500 bg-[length:100%_100%] bg-[bottom] text-white shadow-[inset_0px_1px_0px_0px_--theme(--color-white/.16)] hover:bg-[length:100%_150%] sm:mb-0 sm:w-auto"
                    >
                      <span className="relative inline-flex items-center">
                        Start Building
                        <span className="ml-1 tracking-normal text-white/50 transition-transform group-hover:translate-x-0.5">
                          -&gt;
                        </span>
                      </span>
                    </span>
                  </Spring>
                </div>
                <div data-aos="fade-up" data-aos-delay={600}>
                  <Spring {...animButtonBig(53, 64, 82)} className="mb-4 rounded-md">
                    <span className="btn relative w-full bg-linear-to-b from-gray-800 to-gray-800/60 bg-[length:100%_100%] before:z-[-1] bg-[bottom] text-gray-300 before:pointer-events-none before:absolute before:inset-0 before:rounded-[inherit] before:border before:border-transparent before:[background:linear-gradient(to_right,var(--color-gray-800),var(--color-gray-700),var(--color-gray-800))_border-box] before:[mask-composite:exclude_!important] before:[mask:linear-gradient(white_0_0)_padding-box,_linear-gradient(white_0_0)] hover:bg-[length:100%_150%] sm:ml-4 sm:w-auto"
                 
                    >
                      Schedule Demo
                    </span>
                  </Spring>
                </div>
              </div>
            </div>
          </div>

          <ModalVideo
            thumb={VideoThumb}
            thumbWidth={1104}
            thumbHeight={576}
            thumbAlt="Modal video thumbnail"
            video="videos//video.mp4"
            videoWidth={1920}
            videoHeight={1080}
          />
        </div>
      </div>
    </section>
  );
}
