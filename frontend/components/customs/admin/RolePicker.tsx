import React from 'react';
import { GraduationCap, Presentation } from 'lucide-react';
import { ROLE_LABEL } from '@/constants/roles';

export const RolePicker: React.FC<{ value: 'teacher' | 'student'; onChange: (r: 'teacher' | 'student') => void }> = ({ value, onChange }) => (
  <div className="grid grid-cols-2 gap-2">
    {(['teacher', 'student'] as const).map((r) => (
      <button
        key={r}
        type="button"
        onClick={() => onChange(r)}
        className={`rounded-2xl border-2 px-4 py-3 flex items-center gap-2 font-black text-sm transition ${
          value === r ? (r === 'teacher' ? 'border-kh-purple bg-duo-purple-light text-kh-purple' : 'border-duo-green bg-duo-green-light text-duo-green-dark') : 'border-duo-swan text-duo-wolf hover:bg-duo-polar'
        }`}
      >
        {r === 'teacher' ? <Presentation className="w-5 h-5" /> : <GraduationCap className="w-5 h-5" />}
        {ROLE_LABEL[r]}
      </button>
    ))}
  </div>
);
