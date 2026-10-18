import type {StatusInput} from './types'

export function StatusEditor({value,zone,disabled,onChange,onClear}:{value:StatusInput;zone:string;disabled:boolean;onChange:(value:StatusInput)=>void;onClear:()=>void}){
 return <fieldset disabled={disabled} className="profile-status-fields"><legend>Custom status</legend>
  <div className="field-row"><label className="field">Status emoji<input value={value.emoji} maxLength={64} placeholder="🌴" onChange={event=>onChange({...value,emoji:event.target.value})}/></label><label className="field">Status text<input value={value.text} maxLength={160} placeholder="What’s your status?" onChange={event=>onChange({...value,text:event.target.value})}/></label></div>
  <label className="field">Clear after<select aria-label="Clear after" value={value.clearAfter} onChange={event=>onChange({...value,clearAfter:event.target.value as StatusInput['clearAfter']})}>
   <option value="never">Never</option><option value="30m">30 minutes</option><option value="1h">1 hour</option><option value="4h">4 hours</option><option value="today">Today</option><option value="week">This week</option><option value="date">Choose date and time</option>
  </select></label>
  {value.clearAfter==='date'&&<label className="field">Clear at ({zone})<input type="datetime-local" required value={value.localAt??''} onChange={event=>onChange({...value,localAt:event.target.value})}/></label>}
  <p className="dialog-note">Today ends at midnight and this week ends on Monday, in your chosen time zone.</p><button type="button" className="soft-button" onClick={onClear}>Clear status now</button>
 </fieldset>
}
