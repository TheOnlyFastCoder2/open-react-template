import '@/app/css/workflows.css'
import Image from 'next/image';
import WorflowImg01 from '@/public/images/workflow-01.png';
import WorflowImg02 from '@/public/images/workflow-02.png';
import WorflowImg03 from '@/public/images/workflow-03.png';
import { Spring } from '@/utils/stm/react/animation/Spring';
import { animSubLabel, animText } from '@/app/animations';

const cards = [
  {
    img: WorflowImg01,
    alt: 'Workflow 01',
    label: 'Built-in Tools',
    text: "Streamline the product development flow with a content platform that's aligned across specs and insights.",
  },
  {
    img: WorflowImg02,
    alt: 'Workflow 02',
    label: 'Scale Instantly',
    text: "Streamline the product development flow with a content platform that's aligned across specs and insights.",
  },
  {
    img: WorflowImg03,
    alt: 'Workflow 03',
    label: 'Tailored Flows',
    text: "Streamline the product development flow with a content platform that's aligned across specs and insights.",
  },
];

export default function Workflows() {
  return (
    <section id="Workflows">
      <div className="wf-container">
        <div className="wf-block">
          {/* Section header */}
          <div className="wf-header">
            <div className="wf-sublabel">
              <Spring visibility={{ enterAt: [[0, 1]] }} {...animSubLabel}>
                <span className="wf-gradientText">Tailored Workflows</span>
              </Spring>
            </div>

            <Spring {...animText} visibility={{ enterAt: [[0, 1]] }}>
              <h2 className="wf-title">Map your product journey</h2>
            </Spring>

            <Spring {...animText} visibility={{ enterAt: [[0, 1]], delay: 500 }}>
              <p className="wf-desc">
                Simple and elegant interface to start collaborating with your team in minutes. It seamlessly integrates
                with your code and your favorite programming languages.
              </p>
            </Spring>
          </div>

          {/* Spotlight items */}
          <div className="wf-grid wf-group">
            {cards.map((card, i) => (
              <Spring
                key={i}
                isMove
                moveShadow
                triggers={['down']}
                classInner="wf-gridInner"
                spring={{
                  perspective: { values: { default: 700 } },
                  rotateX: { stiffness: 120, damping: 30 },
                  rotateY: { stiffness: 120, damping: 30 },
                }}
              >
                <a href="#0" className="wf-card">
                  <div className="wf-cardInner">
                    {/* Arrow */}
                    <div className="wf-cardArrow" aria-hidden="true">
                      <svg xmlns="http://www.w3.org/2000/svg" width={9} height={8} fill="none">
                        <path
                          fill="#F4F4F5"
                          d="m4.92 8-.787-.763 2.733-2.68H0V3.443h6.866L4.133.767 4.92 0 9 4 4.92 8Z"
                        />
                      </svg>
                    </div>

                    {/* Image */}
                    <Image className="wf-img" src={card.img} width={350} height={288} alt={card.alt} />

                    {/* Content */}
                    <div className="wf-cardContent">
                      <div className="wf-cardBadgeWrap">
                        <span className="wf-badge">
                          <span className="wf-gradientText">{card.label}</span>
                        </span>
                      </div>
                      <p className="wf-cardText">{card.text}</p>
                    </div>
                  </div>
                </a>
              </Spring>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
