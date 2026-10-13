// The brand colour the installer saves is the one accent of Nook's rose design. Installs made
// before the rose design saved the old default blue; that exact value is the old default, not a
// choice, so it maps to the new brand accent. Any other saved colour is the owner's own.
export const brandAccent = '#c24e5b'
const previousDefault = '#5678dc'
export const migrateAccent = colour => typeof colour === 'string' && colour.toLowerCase() === previousDefault ? brandAccent : colour
