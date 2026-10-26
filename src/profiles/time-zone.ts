import {browserTimeZone} from './TimeZonePicker'

/** A server fallback is operational state, never a person's selected zone. */
export function profileTimeZone(person:{zone?:string;zoneChosen?:boolean}){
 return person.zoneChosen===false||!person.zone?browserTimeZone():person.zone
}
