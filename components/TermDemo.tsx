'use client'

// Demonstração visual de cada termo num "viewfinder" — animações CSS puras
// mapeadas pelo hint `demo` do termo; efeitos web reagem ao mouse de verdade.

import { useRef, useState } from 'react'

const S = 'demo-subject'

function Anim({ subject, bg, extra }: { subject?: string; bg?: string; extra?: React.ReactNode }) {
  return (
    <>
      <div className="demo-bg" style={bg ? { animation: bg } : undefined} />
      <div className={S} style={subject ? { animation: subject } : undefined} />
      {extra}
    </>
  )
}

function TiltDemo() {
  const ref = useRef<HTMLDivElement>(null)
  const [t, setT] = useState('')
  return (
    <div
      ref={ref}
      className="absolute inset-0 grid place-items-center"
      style={{ perspective: '300px' }}
      onMouseMove={e => {
        const r = ref.current!.getBoundingClientRect()
        const x = (e.clientX - r.left) / r.width - 0.5
        const y = (e.clientY - r.top) / r.height - 0.5
        setT(`rotateY(${x * 35}deg) rotateX(${-y * 35}deg)`)
      }}
      onMouseLeave={() => setT('')}
    >
      <div className="demo-bg" />
      <div className={S} style={{ transform: t, transition: t ? 'none' : 'transform .4s' }} />
    </div>
  )
}

function MagneticDemo() {
  const ref = useRef<HTMLDivElement>(null)
  const [t, setT] = useState('')
  return (
    <div
      ref={ref}
      className="absolute inset-0 grid place-items-center"
      onMouseMove={e => {
        const r = ref.current!.getBoundingClientRect()
        const x = e.clientX - r.left - r.width / 2
        const y = e.clientY - r.top - r.height / 2
        setT(`translate(${x * 0.35}px, ${y * 0.35}px)`)
      }}
      onMouseLeave={() => setT('')}
    >
      <div className="demo-bg" />
      <div className={S} style={{ transform: t, transition: t ? 'transform .12s' : 'transform .5s', borderRadius: '50%' }} />
    </div>
  )
}

function TrailDemo() {
  const [dots, setDots] = useState<Array<{ x: number; y: number; id: number }>>([])
  return (
    <div
      className="absolute inset-0"
      onMouseMove={e => {
        const r = (e.currentTarget as HTMLDivElement).getBoundingClientRect()
        const dot = { x: e.clientX - r.left, y: e.clientY - r.top, id: Date.now() + Math.random() }
        setDots(d => [...d.slice(-14), dot])
      }}
    >
      <div className="demo-bg" />
      {dots.map((d, i) => (
        <div key={d.id} className="absolute rounded-full bg-[#e8e4d8] pointer-events-none"
          style={{ left: d.x, top: d.y, width: 4 + i, height: 4 + i, opacity: (i + 1) / dots.length * 0.8, transform: 'translate(-50%,-50%)' }} />
      ))}
      <p className="absolute bottom-2 left-0 right-0 text-center text-[9px] text-white/40 z-2">passe o mouse</p>
    </div>
  )
}

function ParallaxDemo() {
  const [y, setY] = useState(0.5)
  return (
    <div className="absolute inset-0 overflow-hidden" onMouseMove={e => {
      const r = (e.currentTarget as HTMLDivElement).getBoundingClientRect()
      setY((e.clientY - r.top) / r.height)
    }}>
      <div className="demo-bg" style={{ transform: `translateY(${(y - 0.5) * -14}px)` }} />
      <div className="absolute inset-x-0 bottom-0 h-10 bg-[#2e2e2a]" style={{ transform: `translateY(${(y - 0.5) * -30}px)` }} />
      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
        <div className={S} style={{ transform: `translateY(${(y - 0.5) * -55}px)` }} />
      </div>
    </div>
  )
}

function ParticlesDemo() {
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null)
  const pts = Array.from({ length: 24 }, (_, i) => ({
    x: (i * 37) % 100, y: (i * 53) % 100,
  }))
  return (
    <div className="absolute inset-0" onMouseMove={e => {
      const r = (e.currentTarget as HTMLDivElement).getBoundingClientRect()
      setPos({ x: ((e.clientX - r.left) / r.width) * 100, y: ((e.clientY - r.top) / r.height) * 100 })
    }} onMouseLeave={() => setPos(null)}>
      <div className="demo-bg" />
      {pts.map((p, i) => {
        let dx = 0, dy = 0
        if (pos) {
          const ddx = p.x - pos.x, ddy = p.y - pos.y
          const d = Math.max(Math.hypot(ddx, ddy), 6)
          if (d < 30) { dx = (ddx / d) * (30 - d) * 0.7; dy = (ddy / d) * (30 - d) * 0.7 }
        }
        return <div key={i} className="absolute w-1 h-1 rounded-full bg-white/50 transition-transform duration-150"
          style={{ left: `${p.x}%`, top: `${p.y}%`, transform: `translate(${dx}px,${dy}px)` }} />
      })}
    </div>
  )
}

const GRAIN_BG = `repeating-conic-gradient(rgba(255,255,255,0.08) 0% 0.3%, transparent 0.3% 0.9%)`

export default function TermDemo({ demo }: { demo?: string }) {
  const d = demo || ''
  let content: React.ReactNode

  switch (true) {
    case /tilt3d/.test(d): content = <TiltDemo />; break
    case /magnetic/.test(d): content = <MagneticDemo />; break
    case /cursortrail/.test(d): content = <TrailDemo />; break
    case /parallax/.test(d): content = <ParallaxDemo />; break
    case /particles-bg/.test(d): content = <ParticlesDemo />; break
    case /dolly(?!.*zoom)|truck/.test(d): content = <Anim bg="demo-dolly 4s ease-in-out infinite" subject="demo-dolly 4s ease-in-out infinite" />; break
    case /vertigo/.test(d): content = <Anim bg="demo-vertigo-bg 4s ease-in-out infinite" subject="demo-vertigo-s 4s ease-in-out infinite" />; break
    case /zoom/.test(d): content = <Anim subject="demo-zoom 4s ease-in-out infinite" />; break
    case /pan/.test(d): content = <Anim bg="demo-pan 5s ease-in-out infinite" subject="demo-pan 5s ease-in-out infinite" />; break
    case /tilt/.test(d): content = <Anim bg="demo-tilt 5s ease-in-out infinite" subject="demo-tilt 5s ease-in-out infinite" />; break
    case /orbit/.test(d): content = <Anim bg="demo-orbit-bg 7s linear infinite" />; break
    case /crane/.test(d): content = <Anim bg="demo-crane 5s ease-in-out infinite" subject="demo-crane 5s ease-in-out infinite" />; break
    case /whip/.test(d): content = <Anim bg="demo-whip 3.2s ease-in-out infinite" subject="demo-whip 3.2s ease-in-out infinite" />; break
    case /handheld|ugc|bts|verite/.test(d): content = <Anim bg="demo-hand .5s linear infinite" subject="demo-hand .4s linear infinite" />; break
    case /focus|macro/.test(d): content = <Anim subject="demo-focus 3.5s ease-in-out infinite" />; break
    case /glitch|vhs/.test(d): content = (
      <>
        <div className="demo-bg" />
        <div className={S} style={{ animation: 'demo-glitch 2.6s linear infinite' }} />
        {/vhs/.test(d) && <div className="absolute inset-x-0 top-0 h-6 bg-white/20 z-2" style={{ animation: 'demo-vhs 3s linear infinite' }} />}
        <div className="absolute inset-0 z-2 pointer-events-none" style={{ background: 'repeating-linear-gradient(0deg, transparent 0 2px, rgba(0,0,0,0.25) 2px 3px)' }} />
      </>
    ); break
    case /liquid/.test(d): content = <Anim subject="demo-liquid 3.5s ease-in-out infinite" />; break
    case /squash/.test(d): content = <Anim subject="demo-squash 1.6s ease-in-out infinite" />; break
    case /stopmotion|clay|cutout/.test(d): content = <Anim subject="demo-stopmo 1.8s steps(9) infinite alternate" />; break
    case /kinetic/.test(d): content = (
      <>
        <div className="demo-bg" />
        <span className="text-[#e8e4d8] font-bold text-lg z-1" style={{ animation: 'demo-kinetic 2.4s ease-in-out infinite' }}>TEXTO</span>
      </>
    ); break
    case /marquee/.test(d): content = (
      <>
        <div className="demo-bg" />
        <div className="absolute whitespace-nowrap text-[#e8e4d8] font-semibold text-sm z-1" style={{ animation: 'demo-marquee 6s linear infinite' }}>
          MODELY · STUDIO · MODELY · STUDIO · MODELY · STUDIO · MODELY · STUDIO ·
        </div>
      </>
    ); break
    case /levitation|silk/.test(d): content = <Anim subject="demo-float 3s ease-in-out infinite" extra={
      <div className="absolute left-1/2 -translate-x-1/2 bottom-6 w-10 h-1.5 rounded-full bg-black/50 blur-[2px]" style={{ animation: 'demo-float 3s ease-in-out infinite reverse' }} />
    } />; break
    case /turntable|spin/.test(d): content = (
      <div className="absolute inset-0 grid place-items-center" style={{ perspective: '260px' }}>
        <div className="demo-bg" />
        <div className={S} style={{ animation: 'demo-spin 4s linear infinite' }} />
      </div>
    ); break
    case /grain/.test(d): content = (
      <>
        <div className="demo-bg" />
        <div className={S} />
        <div className="absolute inset-0 z-2 opacity-70 pointer-events-none" style={{ background: GRAIN_BG, animation: 'demo-grain .4s steps(4) infinite' }} />
      </>
    ); break
    case /aurora|holo/.test(d): content = (
      <>
        <div className="absolute inset-[-40%]" style={{
          background: 'radial-gradient(ellipse at 30% 30%, #5f8dd6 0%, transparent 45%), radial-gradient(ellipse at 70% 60%, #b06ad4 0%, transparent 45%), radial-gradient(ellipse at 50% 80%, #4fae8e 0%, transparent 40%), #191917',
          animation: `demo-aurora 7s ease-in-out infinite${/holo/.test(d) ? ', demo-holo 5s linear infinite' : ''}`,
        }} />
      </>
    ); break
    case /scrollreveal|reveal/.test(d): content = <Anim subject="demo-reveal 3.4s ease-in-out infinite" />; break
    case /glass/.test(d): content = (
      <>
        <div className="absolute inset-[-40%]" style={{ background: 'radial-gradient(circle at 35% 40%, #6d8dc9 0 22%, transparent 23%), radial-gradient(circle at 68% 62%, #b8825f 0 16%, transparent 17%), #22221f', animation: 'demo-aurora 8s ease-in-out infinite' }} />
        <div className="z-1 w-20 h-14 rounded-xl border border-white/30" style={{ background: 'rgba(255,255,255,0.12)', backdropFilter: 'blur(6px)' }} />
      </>
    ); break
    case /dataviz/.test(d): content = (
      <>
        <div className="demo-bg" />
        <div className="z-1 flex items-end gap-1.5 h-14">
          {[0, 1, 2, 3, 4].map(i => (
            <div key={i} className="w-3 rounded-sm bg-[#e8e4d8]" style={{ animation: `demo-bars ${1.6 + i * 0.25}s ease-in-out infinite` }} />
          ))}
        </div>
      </>
    ); break
    case /duotone/.test(d): content = (
      <>
        <div className="absolute inset-0" style={{ background: 'linear-gradient(120deg, #2b4bcf 0 50%, #e0457b 50% 100%)' }} />
        <div className={S} style={{ background: '#12122e', animation: 'demo-float 4s ease-in-out infinite' }} />
      </>
    ); break
    case /halftone/.test(d): content = (
      <>
        <div className="demo-bg" />
        <div className="absolute inset-0 z-1" style={{ background: 'radial-gradient(circle, #e8e4d8 1.6px, transparent 1.7px)', backgroundSize: '9px 9px', maskImage: 'radial-gradient(circle at 50% 50%, black 0 30%, transparent 75%)' }} />
      </>
    ); break
    case /isometric/.test(d): content = (
      <>
        <div className="demo-bg" />
        <div className="z-1" style={{ transform: 'rotateX(55deg) rotateZ(45deg)', transformStyle: 'preserve-3d' }}>
          <div className="w-12 h-12 bg-[#e8e4d8]" style={{ boxShadow: '10px 10px 0 #8d8975, -4px -4px 0 #fdfaf0' }} />
        </div>
      </>
    ); break
    case /neubrutalism/.test(d): content = (
      <>
        <div className="absolute inset-0 bg-[#f5e960]" />
        <div className="z-1 px-4 py-2 bg-white border-[3px] border-black font-bold text-[12px]" style={{ boxShadow: '5px 5px 0 #000', animation: 'demo-float 3s ease-in-out infinite' }}>BOTÃO</div>
      </>
    ); break
    case /morphbtn/.test(d): content = (
      <>
        <div className="demo-bg" />
        <div className="z-1 px-5 py-2 bg-[#e8e4d8] text-[#191917] text-[11px] font-semibold grid place-items-center hover:rounded-full transition-all duration-500 rounded-md cursor-pointer">HOVER</div>
      </>
    ); break
    case /trailer|musicvideo|commercial/.test(d): content = (
      <>
        <div className="demo-bg" style={{ animation: 'demo-pan 6s ease-in-out infinite' }} />
        <div className="absolute inset-x-0 top-0 h-4 bg-black z-2" />
        <div className="absolute inset-x-0 bottom-0 h-4 bg-black z-2" />
        <div className={S} style={{ animation: 'demo-dolly 6s ease-in-out infinite' }} />
      </>
    ); break
    case /talkinghead|newsroom|mockumentary|hero|personification/.test(d): content = (
      <>
        <div className="demo-bg" />
        <div className="z-1 flex flex-col items-center gap-1" style={{ animation: /mockumentary/.test(d) ? 'demo-hand .6s linear infinite' : undefined }}>
          <div className="w-7 h-7 rounded-full bg-[#e8e4d8]" />
          <div className="w-12 h-6 rounded-t-lg bg-[#e8e4d8]" />
        </div>
        {/newsroom/.test(d) && <div className="absolute bottom-3 inset-x-3 h-3 bg-[#c9403f] z-2 rounded-sm" />}
      </>
    ); break
    default: content = <Anim subject="demo-float 3.5s ease-in-out infinite" />
  }

  return <div className="demo-stage demo-frame">{content}</div>
}
