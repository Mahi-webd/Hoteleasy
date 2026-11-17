/* eslint-disable @next/next/no-img-element */
import Film from "@/components/Film";
import Nav, { Logo } from "@/components/Nav";
import Pricing from "@/components/Pricing";
import Reveal from "@/components/Reveal";
import Story from "@/components/Story";
import { APP_URL, faqs, modules, problems, roles } from "@/lib/content";

export default function Home() {
  return (
    <>
      <Nav />
      <main>
        <Story />

        {/* the problem, stated plainly */}
        <section className="relative z-10 bg-paper py-[clamp(96px,12vw,168px)]">
          <div className="shell grid gap-14 md:grid-cols-[1.15fr_1fr] md:gap-20">
            <Reveal>
              <p className="eyebrow">Why HotelEasy</p>
              <h2 className="display mt-5 text-[clamp(34px,4.4vw,60px)]">
                Most hotels still run on ledgers, receipt books and a busy WhatsApp group. <span className="text-mute">Every gap between them leaks revenue.</span>
              </h2>
            </Reveal>
            <Reveal delay={0.1} className="self-end">
              <ul className="border-t border-line">
                {problems.map(([a, b]) => (
                  <li key={a} className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 border-b border-line py-5">
                    <span className="text-[17px] font-medium">{a}</span>
                    <span className="text-[15px] text-mute">{b}</span>
                  </li>
                ))}
              </ul>
              <p className="mt-6 text-[15px] text-mute">HotelEasy replaces all of them with one record that every department shares.</p>
            </Reveal>
          </div>
        </section>

        {/* the film */}
        <section id="film" className="relative z-10 scroll-mt-0 bg-night py-[clamp(96px,12vw,160px)] text-paper">
          <div className="shell">
            <Reveal className="flex flex-wrap items-end justify-between gap-8">
              <div>
                <p className="eyebrow text-brass-soft">The film</p>
                <h2 className="display mt-5 max-w-[16ch] text-[clamp(36px,4.6vw,64px)]">See a full hotel day in three minutes.</h2>
              </div>
              <p className="max-w-[40ch] text-paper/65">From a guest booking online to the owner&apos;s morning report — the whole loop, on one system.</p>
            </Reveal>
            <Reveal delay={0.1}>
              <Film />
            </Reveal>
          </div>
        </section>

        {/* modules */}
        <section id="product" className="relative z-10 bg-stone py-[clamp(96px,12vw,160px)]">
          <div className="shell">
            <Reveal className="max-w-[760px]">
              <p className="eyebrow">The product</p>
              <h2 className="display mt-5 text-[clamp(36px,4.6vw,64px)]">Everything a hotel runs on. Nothing it doesn&apos;t.</h2>
              <p className="mt-5 max-w-[56ch] text-mute">
                Each part talks to the others, so a room charge, a dinner bill and an M-Pesa payment all land on the same folio — and in the same report.
              </p>
            </Reveal>
            <div className="mt-14 grid gap-4 md:grid-cols-6">
              {modules.map((m, i) => (
                <Reveal key={m.title} delay={(i % 3) * 0.06} className={`${m.span}`}>
                  <article className={`group flex h-full flex-col overflow-hidden rounded-[18px] ${m.tone}`}>
                    <div className={`p-7 ${"wide" in m && m.wide ? "md:grid md:grid-cols-[1fr_2fr] md:items-center md:gap-10 md:p-10" : ""}`}>
                      <div>
                        <h3 className="text-[20px] font-medium tracking-[-0.01em]">{m.title}</h3>
                        <p className="mt-2 max-w-[42ch] text-[15px] text-ink/65">{m.body}</p>
                      </div>
                      {"wide" in m && m.wide && (
                        <img src={`/shots/${m.shot}.webp`} alt="" loading="lazy" className="shot mt-8 aspect-[16/9] w-full object-cover object-left-top transition-transform duration-700 group-hover:-translate-y-1 md:mt-0" />
                      )}
                    </div>
                    {!("wide" in m && m.wide) && (
                      <div className={`mt-auto ${"phone" in m && m.phone ? "mt-6 flex h-[300px] justify-center overflow-hidden px-7" : "pl-7"}`}>
                        <img
                          src={`/shots/${m.shot}.webp`}
                          alt=""
                          loading="lazy"
                          className={`transition-transform duration-700 group-hover:-translate-y-2 ${
                            "phone" in m && m.phone
                              ? "h-fit w-[200px] rounded-t-[26px] border-[6px] border-b-0 border-ink"
                              : "aspect-[16/10] w-full rounded-tl-[10px] object-cover object-left-top shadow-[0_0_0_1px_rgba(21,23,27,.06),0_30px_60px_-30px_rgba(21,23,27,.4)]"
                          }`}
                        />
                      </div>
                    )}
                  </article>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        {/* roles */}
        <section className="relative z-10 bg-paper py-[clamp(96px,12vw,160px)]">
          <div className="shell grid gap-14 md:grid-cols-[1fr_1.4fr] md:gap-20">
            <Reveal className="md:sticky md:top-28 md:self-start">
              <p className="eyebrow">For every role</p>
              <h2 className="display mt-5 text-[clamp(36px,4.4vw,60px)]">From the owner to the ground staff.</h2>
              <p className="mt-5 max-w-[42ch] text-mute">
                Each person sees only what their job needs. You decide who can view, create, edit, discount or refund — down to the button.
              </p>
            </Reveal>
            <ul className="border-t border-line">
              {roles.map(([r, d], i) => (
                <Reveal key={r} delay={i * 0.04}>
                  <li className="grid gap-2 border-b border-line py-7 md:grid-cols-[220px_1fr] md:gap-8">
                    <span className="display text-[30px]">{r}</span>
                    <span className="text-mute md:pt-2">{d}</span>
                  </li>
                </Reveal>
              ))}
            </ul>
          </div>
        </section>

        {/* pricing */}
        <section id="pricing" className="relative z-10 bg-stone py-[clamp(96px,12vw,160px)]">
          <div className="shell">
            <Reveal className="flex flex-wrap items-end justify-between gap-6">
              <div>
                <p className="eyebrow">Pricing</p>
                <h2 className="display mt-5 text-[clamp(36px,4.6vw,64px)]">Simple monthly plans.</h2>
              </div>
              <p className="max-w-[44ch] text-mute">Setup help, the assistant and every update are included. Cancel any time.</p>
            </Reveal>
            <Pricing />
            <p className="mt-5 text-[13px] text-mute">Sample prices for illustration — final pricing to be confirmed.</p>
          </div>
        </section>

        {/* questions */}
        <section id="faq" className="relative z-10 bg-paper py-[clamp(96px,12vw,160px)]">
          <div className="shell grid gap-12 md:grid-cols-[1fr_1.6fr] md:gap-20">
            <Reveal>
              <p className="eyebrow">Questions</p>
              <h2 className="display mt-5 text-[clamp(36px,4.4vw,60px)]">What owners ask us first.</h2>
            </Reveal>
            <div className="border-t border-line">
              {faqs.map(([q, a]) => (
                <details key={q} className="group border-b border-line">
                  <summary className="flex min-h-[64px] cursor-pointer list-none items-center justify-between gap-6 py-5 text-[18px] font-medium [&::-webkit-details-marker]:hidden">
                    {q}
                    <span className="relative size-4 shrink-0 text-brass" aria-hidden>
                      <span className="absolute inset-x-0 top-1/2 h-px bg-current" />
                      <span className="absolute inset-y-0 left-1/2 w-px bg-current transition-transform duration-300 group-open:scale-y-0" />
                    </span>
                  </summary>
                  <p className="max-w-[62ch] pb-6 text-mute">{a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        {/* close */}
        <section className="relative z-10 overflow-hidden bg-night py-[clamp(110px,14vw,190px)] text-paper">
          <div aria-hidden className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_120%,rgba(176,127,60,.35),transparent_60%)]" />
          <Reveal className="shell relative text-center">
            <h2 className="display mx-auto max-w-[14ch] text-[clamp(44px,7vw,104px)]">
              Close the ledger. <em className="text-brass-soft">Open HotelEasy.</em>
            </h2>
            <p className="mx-auto mt-7 max-w-[50ch] text-paper/70">
              Start a free trial today: add your rooms and rates, invite your team, and run tonight&apos;s night audit on HotelEasy.
            </p>
            <div className="mt-10 flex flex-wrap justify-center gap-3">
              <a className="btn btn-light" href={APP_URL}>Start free trial</a>
              <a className="btn btn-line" href="#film">Watch the film</a>
            </div>
          </Reveal>
        </section>
      </main>

      <footer className="relative z-10 bg-[#0a1320] py-12 text-[14px] text-paper/55">
        <div className="shell flex flex-wrap items-center justify-between gap-6">
          <Logo light />
          <span>Hotel software made in Kenya · © {new Date().getFullYear()} HotelEasy</span>
          <a className="link" href={APP_URL}>Sign in</a>
        </div>
        <p className="shell mt-6 text-[12px] text-paper/40">Film narration: Piper TTS, LibriTTS voice (CC BY 4.0).</p>
      </footer>
    </>
  );
}
