export function VideoDemo() {
  return (
    <section className="border-t border-[var(--border)] bg-[var(--background)] px-4 py-16 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-5xl">
        <h2 className="text-2xl font-semibold text-white sm:text-3xl text-center">
          Watch RefundGuardian AI in Action
        </h2>
        <p className="mt-3 text-sm text-[var(--muted)] text-center max-w-2xl mx-auto">
          See how our AI detects delayed deliveries in the background and turns them into
          refunds — without you lifting a finger.
        </p>
        <div className="mt-10">
          <div className="relative mx-auto aspect-video max-w-3xl overflow-hidden rounded-3xl border border-emerald-500/60 bg-[radial-gradient(circle_at_top,_#022c22,_#020617)] shadow-[0_0_40px_rgba(16,185,129,0.35)]">
            {/* Poster so mobile always shows a graphic (replace with real video poster when URL exists) */}
            {/* eslint-disable-next-line @next/next/no-img-element -- static public SVG */}
            <img
              src="/demo/video-poster.svg"
              alt=""
              className="absolute inset-0 h-full w-full object-cover opacity-90"
              width={1280}
              height={720}
              loading="eager"
              decoding="async"
            />
            <div className="absolute inset-0 flex items-center justify-center">
              <button
                type="button"
                className="flex h-16 w-16 items-center justify-center rounded-full bg-white/10 backdrop-blur shadow-lg ring-2 ring-emerald-400/80 hover:bg-white/15 transition-colors"
              >
                <svg
                  className="h-7 w-7 text-emerald-400"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                >
                  <path d="M8 5v14l11-7z" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

