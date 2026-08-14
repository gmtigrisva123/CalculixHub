import { m, useTransform, MotionValue } from 'framer-motion';

interface AuroraHeroStageProps {
  progress: MotionValue<number>;
  still?: boolean;
}

export default function AuroraHeroStage({ progress, still }: AuroraHeroStageProps) {
  // As the user scrolls (progress goes from 0 to 1), we scale up and rotate the aurora
  // to give a sense of "diving in"
  const scale = useTransform(progress, [0, 1], [1, 2.5]);
  const rotate = useTransform(progress, [0, 1], [0, 90]);
  const opacity = useTransform(progress, [0, 0.8, 1], [1, 0.5, 0]);

  return (
    <div className="absolute inset-0 w-full h-full overflow-hidden flex items-center justify-center pointer-events-none">
      {/* Subtle noise texture overlay for a premium, tactile feel */}
      <div 
        className="absolute inset-0 z-10 opacity-30 mix-blend-overlay pointer-events-none"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`
        }}
      />
      
      <m.div 
        className="relative w-[120vw] h-[120vh] max-w-[1200px] max-h-[1200px]"
        style={still ? undefined : { scale, rotate, opacity }}
      >
        {/* Glow 1: Vibrant Cyan */}
        <m.div 
          className="absolute top-1/4 left-1/4 w-[40vw] h-[40vw] max-w-[500px] max-h-[500px] rounded-full mix-blend-screen filter blur-[120px] opacity-80"
          style={{ backgroundColor: '#00F0FF' }}
          animate={still ? undefined : {
            x: ['0%', '20%', '-10%', '0%'],
            y: ['0%', '-20%', '10%', '0%'],
            scale: [1, 1.2, 0.9, 1],
          }}
          transition={{ duration: 15, repeat: Infinity, ease: 'easeInOut' }}
        />
        
        {/* Glow 2: Deep Violet/Purple */}
        <m.div 
          className="absolute top-1/3 right-1/4 w-[45vw] h-[45vw] max-w-[600px] max-h-[600px] rounded-full mix-blend-screen filter blur-[130px] opacity-70"
          style={{ backgroundColor: '#8A2BE2' }}
          animate={still ? undefined : {
            x: ['0%', '-25%', '15%', '0%'],
            y: ['0%', '25%', '-15%', '0%'],
            scale: [1, 1.1, 1.3, 1],
          }}
          transition={{ duration: 18, repeat: Infinity, ease: 'easeInOut', delay: 2 }}
        />

        {/* Glow 3: Vibrant Pink/Magenta */}
        <m.div 
          className="absolute bottom-1/4 left-1/3 w-[35vw] h-[35vw] max-w-[450px] max-h-[450px] rounded-full mix-blend-screen filter blur-[100px] opacity-80"
          style={{ backgroundColor: '#FF2E93' }}
          animate={still ? undefined : {
            x: ['0%', '30%', '-20%', '0%'],
            y: ['0%', '10%', '30%', '0%'],
            scale: [1, 0.9, 1.2, 1],
          }}
          transition={{ duration: 12, repeat: Infinity, ease: 'easeInOut', delay: 1 }}
        />

        {/* Glow 4: Bright Amber/Orange */}
        <m.div 
          className="absolute bottom-1/3 right-1/3 w-[30vw] h-[30vw] max-w-[400px] max-h-[400px] rounded-full mix-blend-screen filter blur-[110px] opacity-60"
          style={{ backgroundColor: '#FF8A00' }}
          animate={still ? undefined : {
            x: ['0%', '-15%', '25%', '0%'],
            y: ['0%', '-30%', '15%', '0%'],
            scale: [1, 1.3, 0.8, 1],
          }}
          transition={{ duration: 16, repeat: Infinity, ease: 'easeInOut', delay: 3 }}
        />

        {/* Floating Math Symbols */}
        <div className="absolute inset-0 pointer-events-none text-white font-serif select-none mix-blend-overlay">
          {/* Integral */}
          <m.div 
            className="absolute top-[20%] left-[15%] text-[10rem] opacity-20"
            animate={still ? undefined : { y: ['-5%', '5%', '-5%'], rotate: [-5, 5, -5] }}
            transition={{ duration: 10, repeat: Infinity, ease: 'easeInOut' }}
          >
            ∫
          </m.div>

          {/* Summation */}
          <m.div 
            className="absolute top-[60%] right-[20%] text-[8rem] opacity-[0.15]"
            animate={still ? undefined : { y: ['5%', '-5%', '5%'], rotate: [5, -5, 5] }}
            transition={{ duration: 12, repeat: Infinity, ease: 'easeInOut', delay: 1 }}
          >
            Σ
          </m.div>

          {/* Pi */}
          <m.div 
            className="absolute top-[75%] left-[25%] text-[7rem] opacity-20"
            animate={still ? undefined : { y: ['-8%', '8%', '-8%'], rotate: [-10, 10, -10] }}
            transition={{ duration: 14, repeat: Infinity, ease: 'easeInOut', delay: 2 }}
          >
            π
          </m.div>

          {/* Infinity */}
          <m.div 
            className="absolute top-[30%] right-[30%] text-[9rem] opacity-[0.12]"
            animate={still ? undefined : { y: ['8%', '-8%', '8%'], rotate: [10, -10, 10] }}
            transition={{ duration: 15, repeat: Infinity, ease: 'easeInOut', delay: 0.5 }}
          >
            ∞
          </m.div>

          {/* Nabla / Gradient */}
          <m.div 
            className="absolute top-[10%] right-[45%] text-[6rem] opacity-20"
            animate={still ? undefined : { y: ['-4%', '4%', '-4%'], rotate: [-15, 15, -15] }}
            transition={{ duration: 11, repeat: Infinity, ease: 'easeInOut', delay: 3 }}
          >
            ∇
          </m.div>

          {/* Theta */}
          <m.div 
            className="absolute top-[50%] left-[35%] text-[8rem] opacity-[0.18]"
            animate={still ? undefined : { y: ['6%', '-6%', '6%'], rotate: [8, -8, 8] }}
            transition={{ duration: 13, repeat: Infinity, ease: 'easeInOut', delay: 1.5 }}
          >
            θ
          </m.div>
        </div>
      </m.div>
      
      {/* A dark vignette to ensure text readability in the center */}
      <div className="absolute inset-0 z-0 bg-[radial-gradient(circle_at_center,transparent_0%,rgba(10,10,12,0.6)_60%,rgba(10,10,12,0.95)_100%)] pointer-events-none" />
    </div>
  );
}
