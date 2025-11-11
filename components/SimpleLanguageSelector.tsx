'use client';

interface SimpleLanguageSelectorProps {
  value: string;
  onChange: (lang: string) => void;
}

export function SimpleLanguageSelector({ value, onChange }: SimpleLanguageSelectorProps) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#00C48C] focus:border-transparent outline-none text-gray-900 bg-white font-medium"
    >
      <option value="en">🇬🇧 English</option>
    </select>
  );
}

