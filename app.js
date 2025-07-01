const { useState, useEffect } = React;

function DateForm() {
  const [sykdato, setSykdato] = useState('');
  const [maksdato, setMaksdato] = useState('');
  const [aapFra, setAapFra] = useState('');
  const [aapTil, setAapTil] = useState('');
  const [uforetrygd, setUforetrygd] = useState('');
  const [soknadRegistrert, setSoknadRegistrert] = useState('');
  const [durationText, setDurationText] = useState('');
  const [diffDays, setDiffDays] = useState(null);
  const [teoretiskSykdato, setTeoretiskSykdato] = useState('');
  const [avgUforegrad, setAvgUforegrad] = useState(null);
  const [rawInput, setRawInput] = useState('');

  const copyToClipboard = async (text) => {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      try { await navigator.clipboard.writeText(text); return; } catch {}
    }
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.setAttribute('readonly', '');
    textarea.style.position = 'absolute';
    textarea.style.left = '-9999px';
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand('copy');
    document.body.removeChild(textarea);
  };

  const formatInput = (val) => {
    const digits = val.replace(/\D/g, '');
    if (/^\d{8}$/.test(digits)) {
      const d = digits.slice(0, 2);
      const m = digits.slice(2, 4);
      const y = digits.slice(4);
      return `${d}.${m}.${y}`;
    }
    if (/^\d{2}\.\d{2}\.\d{4}$/.test(val)) return val;
    return digits;
  };

  const parseDate = (str) => {
    const parts = str.split('.').map(Number);
    if (parts.length !== 3) return null;
    const [d, m, y] = parts;
    const date = new Date(y, m - 1, d);
    return isNaN(date) ? null : date;
  };
  const formatDate = (date) => {
    const d = String(date.getDate()).padStart(2, '0');
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const y = date.getFullYear();
    return `${d}.${m}.${y}`;
  };

  const applyVedtakDates = (fraStr, tilStr) => {
    setAapFra(fraStr);
    setAapTil(tilStr);
    const fraDate = parseDate(fraStr);
    if (fraDate) {
      fraDate.setDate(fraDate.getDate() - 1);
      setMaksdato(formatDate(fraDate));
    }
  };

  const parseAutofill = () => {
    const lines = rawInput.split(/\r?\n/);
    let vedtakFra = null;
    const tilDates = [];
    const meldekortHours = [];
    let inVedtak = false;
    let inMeldekort = false;

    const sykdatoMatch = rawInput.match(/Første sykedag:\s*(\d{2}\.\d{2}\.\d{4})/i);
    if (sykdatoMatch) setSykdato(sykdatoMatch[1]);
    const soknMatch = rawInput.match(/første melding om uførhet:\s*(\d{2}\.\d{2}\.\d{4})/i);
    if (soknMatch) setSoknadRegistrert(soknMatch[1]);

    lines.forEach(line => {
      const t = line.trim();
      if (/^Vedtak ID/i.test(t)) { inVedtak = true; inMeldekort = false; return; }
      if (/^Meldekort ID/i.test(t)) { inMeldekort = true; inVedtak = false; return; }
      if (!t) return;
      if (inVedtak) {
        const m = t.match(/\d+\s+(\d{2}\.\d{2}\.\d{4})\s+(\d{2}\.\d{2}\.\d{4})/);
        if (m) {
          const [, fraStr, tilStr] = m;
          tilDates.push(tilStr);
          if (/Innvilgelse av søknad/i.test(t) && !vedtakFra) vedtakFra = fraStr;
        }
      }
      if (inMeldekort) {
        const m2 = t.match(/\d+\s+\d{2}\.\d{2}\.\d{4}\s+\d{2}\.\d{2}\.\d{4}\s+(\d+[\d,]*)/);
        if (m2) meldekortHours.push(parseFloat(m2[1].replace(',', '.')));
      }
    });

    if (vedtakFra) applyVedtakDates(vedtakFra, tilDates.pop());
    if (meldekortHours.length) {
      const sum = meldekortHours.reduce((a, h) => a + h, 0);
      const avg = sum / meldekortHours.length;
      const workPct = (avg / 75) * 100;
      const unwork = 100 - workPct;
      setAvgUforegrad(Math.round(unwork / 5) * 5);
    }
  };

  useEffect(() => {
    const from = parseDate(sykdato);
    const to = parseDate(aapFra || uforetrygd);
    if (from && to) {
      let months = (to.getFullYear() - from.getFullYear()) * 12 + (to.getMonth() - from.getMonth());
      let days = to.getDate() - from.getDate();
      if (days < 0) {
        months--;
        days += new Date(to.getFullYear(), to.getMonth(), 0).getDate();
      }
      setDurationText(`${months} måneder og ${days} dager`);
      setDiffDays(months * 30 + days);
      const totalMonths = 18;
      const remMonths = totalMonths - months;
      const remDays = -days;
      const est = new Date(from);
      est.setMonth(est.getMonth() - remMonths);
      est.setDate(est.getDate() - remDays);
      setTeoretiskSykdato(formatDate(est));
    } else {
      setDurationText('');
      setDiffDays(null);
      setTeoretiskSykdato('');
    }
  }, [sykdato, aapFra, uforetrygd]);

  const statuteText = (() => {
    const reg = parseDate(soknadRegistrert);
    const fra = parseDate(aapFra);
    if (reg && fra) {
      const firstOfMonth = new Date(reg.getFullYear(), reg.getMonth(), 1);
      const diff = Math.floor((fra - firstOfMonth) / (1000 * 60 * 60 * 24));
      return diff > 365 * 3 ? 'Foreldelse' : 'Ikke foreldelse';
    }
    return '';
  })();
  const statuteClass = statuteText === 'Foreldelse' ? 'text-red-700' : 'text-green-700';

  const handleClear = () => {
    setSykdato('');
    setMaksdato('');
    setAapFra('');
    setAapTil('');
    setUforetrygd('');
    setSoknadRegistrert('');
    setDurationText('');
    setDiffDays(null);
    setTeoretiskSykdato('');
    setAvgUforegrad(null);
    setRawInput('');
  };

  const fieldClass = 'border p-2 rounded w-full';
  const copyBtnClass = 'ml-2 px-3 py-1 bg-blue-500 text-white rounded text-sm';

  return (
    <div className="p-4 space-y-6">
      <textarea
        value={rawInput}
        onChange={e => setRawInput(e.target.value)}
        placeholder="Lim inn rådata..."
        className="w-full h-24 border p-2 rounded"
      />
      <button
        onClick={parseAutofill}
        className="px-4 py-2 bg-green-600 text-white rounded"
      >Autofyll</button>

      <div className="space-y-4">
        {[
          { label: 'Sykdato', value: sykdato, onChange: v => setSykdato(formatInput(v)) },
          { label: 'Maksdato', value: maksdato, onChange: v => setMaksdato(formatInput(v)) },
          { label: 'AAP Fra', value: aapFra, onChange: v => applyVedtakDates(v, aapTil) },
          { label: 'AAP Til', value: aapTil, onChange: v => setAapTil(formatInput(v)) },
          { label: 'Søknad registrert', value: soknadRegistrert, onChange: v => setSoknadRegistrert(formatInput(v)) },
          { label: 'Uføretrygd', value: uforetrygd, onChange: v => setUforetrygd(formatInput(v)) }
        ].map(({ label, value, onChange }) => (
          <div key={label} className="flex items-center">
            <div className="flex-1">
              <label className="block text-sm font-medium">{label}</label>
              <input
                type="text"
                placeholder="DDMMYYYY"
                value={value}
                onChange={e => onChange(e.target.value)}
                className={fieldClass}
              />
            </div>
            <button
              type="button"
              onClick={() => copyToClipboard(value)}
              className={copyBtnClass}
              disabled={!value}
            >Kopier</button>
          </div>
        ))}
        <button
          onClick={handleClear}
          className="px-2 py-1 bg-blue-600 text-white rounded text-sm float-left"
        >Tøm alle</button>
      </div>

      <div className="mt-4 clear-left p-4 bg-gray-100 rounded space-y-2">
        {durationText && (
          <p className={`font-medium ${diffDays >= 325 && diffDays <= 405 ? 'text-green-700' : 'text-red-700'}`}>Syk til vedtak: {durationText}</p>
        )}
        {teoretiskSykdato && <p>Teoretisk sykdato: {teoretiskSykdato}</p>}
        {avgUforegrad != null && <p>Gjennomsnittlig uføregrad: {avgUforegrad}%</p>}
        {statuteText && (
          <p className={statuteClass}>Søknad registrert: {soknadRegistrert} – {statuteText}</p>
        )}
      </div>
    </div>
  );
}

ReactDOM.render(<DateForm />, document.getElementById('root'));
