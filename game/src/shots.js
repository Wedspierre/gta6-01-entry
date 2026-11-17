// The screenshot scenes behind ?shot=cover|start|mission|chase (with &seed=N).
// Each one stages a real game state — a car the player is driving, police in
// pursuit, a mission in progress — and main.js then runs it forward a couple of
// seconds so traffic, the police and the camera settle before the frame is taken.
// The same seed always gives the same frame.

export const SHOT_NAMES = ['cover', 'start', 'mission', 'chase'];

/**
 * The staging recipe for one shot. `place` picks the branch main.js takes:
 * 'start' is the title screen over Downtown; 'mission' is Marco on foot at
 * Neon Row mid-fight; anything else is a driving chase on the main avenue.
 */
export function shotSetup(name) {
  switch (name) {
    case 'start':
      return {
        place: 'start',
        note: 'Title screen over a slow orbit of Downtown Solmara.',
      };
    case 'mission':
      return {
        place: 'mission',
        note: 'On foot at Neon Row, mission 3 in progress, four Rust Vipers ahead, one star.',
      };
    case 'chase':
      return {
        place: 'drive',
        carModel: 0,      // Bantam Coupe
        carColor: 0,
        startZ: 60,
        speed: 32,
        wanted: 4,
        police: 3,
        note: 'High-speed chase downtown, four stars, three interceptors behind.',
      };
    case 'cover':
    default:
      return {
        place: 'drive',
        carModel: 2,      // Cometa GT, the gold one
        carColor: 0,
        startZ: 120,
        speed: 26,
        wanted: 3,
        police: 2,
        note: 'The cover: gold Cometa GT down the main avenue, two police cars closing in.',
      };
  }
}
