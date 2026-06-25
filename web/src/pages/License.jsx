// License & attribution page. Organized summary of LICENSE_NOTICES.txt.
// Not legal advice; does not replace the upstream license texts.

function Section({ title, children }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
      <h2 className="text-base font-bold text-slate-800">{title}</h2>
      <div className="mt-3 space-y-2 text-sm leading-relaxed text-slate-600">{children}</div>
    </section>
  );
}

function Ext({ href, children }) {
  return (
    <a href={href} target="_blank" rel="noreferrer"
      className="break-all text-brand-700 underline decoration-brand-300 underline-offset-2 hover:text-brand-800">
      {children || href}
    </a>
  );
}

const COMPONENTS = [
  {
    name: "Supertonic 실행 코드",
    license: "MIT License",
    copyright: "Copyright (c) 2025 Supertone Inc.",
    note: "Supertonic을 호출하는 예제 코드·문서에 적용되는 비교적 자유로운 라이선스입니다. 코드가 MIT라고 해서 음성 모델 가중치까지 동일 조건이 적용되는 것은 아닙니다.",
    link: "https://github.com/supertone-inc/supertonic",
  },
  {
    name: "Supertonic 3 모델 가중치",
    license: "OpenRAIL-M (Open RAIL-M 계열)",
    copyright: "Copyright (c) 2026 Supertone Inc.",
    note: "실제 음성 합성을 담당하는 모델 가중치로, 책임 있는 AI 사용 조건이 붙습니다. 사칭·무단 음성 복제·기만·유해 콘텐츠 자동 생성 등은 제한됩니다. 외부 공개 결과물에 쓰기 전 모델 라이선스를 검토하세요.",
    link: "https://huggingface.co/Supertone/supertonic-3/blob/main/LICENSE",
  },
  {
    name: "faster-whisper",
    license: "MIT License",
    copyright: "Copyright (c) 2023 SYSTRAN",
    note: "생성된 WAV를 다시 분석해 발화 구간에 가까운 SRT/VTT 자막을 만드는 데 사용합니다. 런타임은 MIT이지만, 별도로 받는 Whisper 계열 모델 파일은 자체 라이선스를 따릅니다.",
    link: "https://github.com/SYSTRAN/faster-whisper",
  },
  {
    name: "FFmpeg",
    license: "GPLv3 / LGPLv2.1-or-later",
    copyright: "선택 설치 · 본 패키지 미포함",
    note: "서버 내부에서 WAV→MP3 변환(libmp3lame)에만 사용합니다. TTS 음성 생성에는 필수가 아닙니다. GPL 빌드 바이너리를 제3자에게 배포·제공하면 GPL/LGPL 고지·소스 제공 의무가 생길 수 있습니다.",
    link: "https://www.ffmpeg.org/legal.html",
  },
  {
    name: "이 통합 패키지",
    license: "각 upstream 조건 적용",
    copyright: "공식 Supertone/SYSTRAN 제품 아님",
    note: "Supertonic 3, faster-whisper, 로컬 UI, 실행 스크립트, 샘플을 하나의 작업 흐름으로 묶은 통합 도구입니다. 생성 음성·대본·자막·로그·공개 콘텐츠에 대한 책임은 사용자에게 있습니다.",
    link: null,
  },
];

const LINKS = [
  ["Supertonic (GitHub)", "https://github.com/supertone-inc/supertonic"],
  ["Supertonic 3 모델 라이선스", "https://huggingface.co/Supertone/supertonic-3/blob/main/LICENSE"],
  ["faster-whisper (GitHub)", "https://github.com/SYSTRAN/faster-whisper"],
  ["FFmpeg legal", "https://www.ffmpeg.org/legal.html"],
  ["Gyan FFmpeg builds", "https://www.gyan.dev/ffmpeg/builds/"],
];

export default function License() {
  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <header>
        <h1 className="text-xl font-bold text-slate-800">라이선스 및 고지</h1>
        <p className="mt-1 text-sm text-slate-500">License &amp; Attribution Notices</p>
      </header>

      <div className="rounded-xl border border-amber-200 bg-brand-50 px-4 py-3 text-sm leading-relaxed text-brand-800">
        이 페이지는 실무용 라이선스·출처 요약입니다. <strong>법률 자문이 아니며</strong>, Supertonic·Supertonic 3
        모델·faster-whisper·기타 의존성의 원본 라이선스 전문을 대체하지 않습니다. 무료로 실행할 수 있다는 사실과
        공개 콘텐츠에 자유롭게 사용할 수 있다는 사실은 별개입니다.
      </div>

      <Section title="핵심 요약">
        <ol className="list-decimal space-y-1.5 pl-5">
          <li>본 서비스는 Supertonic 3 기반 전용 TTS 웹 서비스입니다. 공식 Supertone/SYSTRAN 제품이 아닙니다.</li>
          <li>FFmpeg는 서버 내부 WAV→MP3 변환에만 사용하며, 사용자에게 FFmpeg 바이너리를 직접 제공하지 않습니다.</li>
          <li>“무료 이용”이 무제한 권리 부여를 뜻하지는 않습니다. 코드(MIT)와 모델 가중치(OpenRAIL-M) 조건은 별개입니다.</li>
          <li>생성한 텍스트·음성·자막·공개 콘텐츠에 대한 책임은 이용자에게 있습니다.</li>
          <li>향후 설치 패키지 배포·온프레미스 납품·FFmpeg 바이너리 제공 등 서비스 형태를 변경하면 이 고지와 FFmpeg 빌드 옵션을 다시 검토해야 합니다.</li>
        </ol>
      </Section>

      <Section title="구성 요소별 라이선스">
        <div className="space-y-3">
          {COMPONENTS.map((c) => (
            <div key={c.name} className="rounded-xl border border-slate-200 p-4">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <span className="font-semibold text-slate-800">{c.name}</span>
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">{c.license}</span>
              </div>
              <p className="mt-1 text-xs text-slate-400">{c.copyright}</p>
              <p className="mt-2">{c.note}</p>
              {c.link && <p className="mt-2 text-xs"><Ext href={c.link} /></p>}
            </div>
          ))}
        </div>
      </Section>

      <Section title="사용자 책임 및 사용 제한">
        <p>
          다음 용도로 사용하면 안 됩니다: 사칭, 동의 없는 음성 복제·딥페이크, 기만적 생성, 괴롭힘·명예훼손, 미성년자 대상
          유해 행위, 차별적 사용, 의료적 판단, 법 집행·사법 예측 프로파일링, 기타 불법·유해 자동 생성.
        </p>
        <p>
          개인 테스트·발음 예제·내부 초안 검토와, 유튜브 영상·강의 교재·광고·판매용 콘텐츠처럼 외부에 노출되는 결과물
          제작은 책임 범위가 다릅니다. 공개 콘텐츠·재배포·서비스 제공에 사용할 때는 원본 upstream 라이선스를 함께 확인하세요.
        </p>
      </Section>

      <Section title="개인정보 · 데이터 보관">
        <ul className="list-disc space-y-1.5 pl-5">
          <li>로그인 시 이메일·계정 정보가 인증(Supabase Auth)에 저장됩니다.</li>
          <li>생성한 입력 본문 텍스트·음성(MP3)·자막(SRT)은 계정에 연결되어 저장되며, “생성 내역” 페이지에서 다시 확인·다운로드할 수 있습니다.</li>
          <li>저장된 항목은 자동으로 삭제되지 않습니다. “생성 내역”에서 직접 삭제할 때 음성 파일과 기록이 함께 제거됩니다.</li>
          <li>오디오 다운로드 링크(서명 URL)는 보안을 위해 발급 후 약 1시간이 지나면 만료됩니다. 이는 링크 만료일 뿐, 저장된 파일 자체가 삭제되는 것은 아닙니다.</li>
          <li>서버 측 TTS 특성상, 처리 중 메모리 접근 자체는 제거할 수 없습니다.</li>
        </ul>
      </Section>

      <Section title="Upstream · 참고 링크">
        <ul className="space-y-1.5">
          {LINKS.map(([label, href]) => (
            <li key={href} className="flex flex-col">
              <span className="text-xs font-medium text-slate-500">{label}</span>
              <Ext href={href} />
            </li>
          ))}
        </ul>
      </Section>

      <Section title="출처 · 갱신">
        <p>로컬 UI · 워크플로 아이디어 출처: Curator Danbi’s Web App Idea Archive — <Ext href="https://min-inter.co.kr">min-inter.co.kr</Ext></p>
        <p className="text-xs text-slate-400">최초 작성 2026-05-17 · 공개 서비스 고지 갱신 2026-05-27</p>
      </Section>
    </div>
  );
}
