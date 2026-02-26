import type { ExerciseSeed } from '../types';

export const exercises: ExerciseSeed[] = [
  // ── Chest ────────────────────────────────────────────────────────────────
  {
    name: 'Barbell Bench Press',
    description:
      'Lie on a flat bench and press a barbell upward from chest level to full arm extension.',
    type: 'strength',
    groupKey: 'chest',
    equipment: ['barbell', 'bench'],
    difficulty: 'intermediate',
    imageURL: null,
  },
  {
    name: 'Incline Dumbbell Press',
    description:
      'Press dumbbells upward while lying on an incline bench set to 30-45 degrees.',
    type: 'strength',
    groupKey: 'chest',
    equipment: ['dumbbells', 'incline bench'],
    difficulty: 'intermediate',
    imageURL: null,
  },
  {
    name: 'Dumbbell Fly',
    description:
      'Lie on a flat bench with dumbbells extended above chest, then lower them out to the sides in a wide arc.',
    type: 'strength',
    groupKey: 'chest',
    equipment: ['dumbbells', 'bench'],
    difficulty: 'intermediate',
    imageURL: null,
  },
  {
    name: 'Cable Crossover',
    description:
      'Stand between cable pulleys and bring handles together in front of your chest in a hugging motion.',
    type: 'strength',
    groupKey: 'chest',
    equipment: ['cable machine'],
    difficulty: 'intermediate',
    imageURL: null,
  },
  {
    name: 'Push-Up',
    description:
      'Start in a plank position and lower your body until your chest nearly touches the floor, then push back up.',
    type: 'bodyweight',
    groupKey: 'chest',
    equipment: [],
    difficulty: 'beginner',
    imageURL: null,
  },
  {
    name: 'Dips (Chest)',
    description:
      'Lean forward on parallel bars and lower your body by bending your arms, then push back up.',
    type: 'bodyweight',
    groupKey: 'chest',
    equipment: ['dip bars'],
    difficulty: 'intermediate',
    imageURL: null,
  },

  // ── Back ─────────────────────────────────────────────────────────────────
  {
    name: 'Deadlift',
    description:
      'Lift a loaded barbell from the floor to hip level by extending your hips and knees.',
    type: 'strength',
    groupKey: 'back',
    equipment: ['barbell'],
    difficulty: 'advanced',
    imageURL: null,
  },
  {
    name: 'Barbell Row',
    description:
      "Bend at the hips with a barbell hanging at arm's length, then pull the bar to your lower chest.",
    type: 'strength',
    groupKey: 'back',
    equipment: ['barbell'],
    difficulty: 'intermediate',
    imageURL: null,
  },
  {
    name: 'Pull-Up',
    description:
      'Hang from a bar with an overhand grip and pull yourself up until your chin is above the bar.',
    type: 'bodyweight',
    groupKey: 'back',
    equipment: ['pull-up bar'],
    difficulty: 'advanced',
    imageURL: null,
  },
  {
    name: 'Lat Pulldown',
    description:
      'Sit at a lat pulldown machine and pull the bar down to your upper chest.',
    type: 'strength',
    groupKey: 'back',
    equipment: ['cable machine'],
    difficulty: 'beginner',
    imageURL: null,
  },
  {
    name: 'Seated Cable Row',
    description:
      'Sit at a cable row station and pull the handle to your torso while keeping your back straight.',
    type: 'strength',
    groupKey: 'back',
    equipment: ['cable machine'],
    difficulty: 'beginner',
    imageURL: null,
  },
  {
    name: 'Dumbbell Single-Arm Row',
    description:
      'Place one knee and hand on a bench, then row a dumbbell to your hip with the other arm.',
    type: 'strength',
    groupKey: 'back',
    equipment: ['dumbbell', 'bench'],
    difficulty: 'beginner',
    imageURL: null,
  },

  // ── Shoulders ────────────────────────────────────────────────────────────
  {
    name: 'Overhead Press',
    description:
      'Press a barbell from shoulder height to overhead with full arm extension.',
    type: 'strength',
    groupKey: 'shoulders',
    equipment: ['barbell'],
    difficulty: 'intermediate',
    imageURL: null,
  },
  {
    name: 'Dumbbell Lateral Raise',
    description:
      'Stand with dumbbells at your sides and raise them outward to shoulder height.',
    type: 'strength',
    groupKey: 'shoulders',
    equipment: ['dumbbells'],
    difficulty: 'beginner',
    imageURL: null,
  },
  {
    name: 'Dumbbell Front Raise',
    description:
      'Stand with dumbbells at your thighs and raise them forward to shoulder height.',
    type: 'strength',
    groupKey: 'shoulders',
    equipment: ['dumbbells'],
    difficulty: 'beginner',
    imageURL: null,
  },
  {
    name: 'Face Pull',
    description:
      'Pull a rope attachment on a cable machine toward your face, separating the ends.',
    type: 'strength',
    groupKey: 'shoulders',
    equipment: ['cable machine'],
    difficulty: 'beginner',
    imageURL: null,
  },
  {
    name: 'Arnold Press',
    description:
      'Start with dumbbells at chin height with palms facing you, rotate and press overhead.',
    type: 'strength',
    groupKey: 'shoulders',
    equipment: ['dumbbells'],
    difficulty: 'intermediate',
    imageURL: null,
  },
  {
    name: 'Reverse Dumbbell Fly',
    description:
      'Bend forward at the hips and raise dumbbells out to the sides, targeting rear delts.',
    type: 'strength',
    groupKey: 'shoulders',
    equipment: ['dumbbells'],
    difficulty: 'beginner',
    imageURL: null,
  },

  // ── Arms ─────────────────────────────────────────────────────────────────
  {
    name: 'Barbell Curl',
    description:
      'Stand with a barbell and curl it upward by flexing your elbows.',
    type: 'strength',
    groupKey: 'arms',
    equipment: ['barbell'],
    difficulty: 'beginner',
    imageURL: null,
  },
  {
    name: 'Dumbbell Hammer Curl',
    description:
      'Curl dumbbells with a neutral (palms facing each other) grip.',
    type: 'strength',
    groupKey: 'arms',
    equipment: ['dumbbells'],
    difficulty: 'beginner',
    imageURL: null,
  },
  {
    name: 'Tricep Pushdown',
    description:
      'Push a cable attachment downward by extending your elbows while keeping upper arms stationary.',
    type: 'strength',
    groupKey: 'arms',
    equipment: ['cable machine'],
    difficulty: 'beginner',
    imageURL: null,
  },
  {
    name: 'Skull Crusher',
    description:
      'Lie on a bench and lower a barbell or EZ bar to your forehead by bending your elbows, then extend.',
    type: 'strength',
    groupKey: 'arms',
    equipment: ['ez bar', 'bench'],
    difficulty: 'intermediate',
    imageURL: null,
  },
  {
    name: 'Concentration Curl',
    description:
      'Sit on a bench, brace your elbow against your inner thigh, and curl a dumbbell.',
    type: 'strength',
    groupKey: 'arms',
    equipment: ['dumbbell', 'bench'],
    difficulty: 'beginner',
    imageURL: null,
  },
  {
    name: 'Overhead Tricep Extension',
    description:
      'Hold a dumbbell overhead with both hands and lower it behind your head by bending your elbows.',
    type: 'strength',
    groupKey: 'arms',
    equipment: ['dumbbell'],
    difficulty: 'beginner',
    imageURL: null,
  },

  // ── Legs ─────────────────────────────────────────────────────────────────
  {
    name: 'Barbell Squat',
    description:
      'With a barbell on your upper back, squat down until thighs are parallel to the floor, then stand.',
    type: 'strength',
    groupKey: 'legs',
    equipment: ['barbell', 'squat rack'],
    difficulty: 'intermediate',
    imageURL: null,
  },
  {
    name: 'Leg Press',
    description:
      'Sit in a leg press machine and push the platform away by extending your knees and hips.',
    type: 'strength',
    groupKey: 'legs',
    equipment: ['leg press machine'],
    difficulty: 'beginner',
    imageURL: null,
  },
  {
    name: 'Romanian Deadlift',
    description:
      'Hold a barbell at hip height and hinge forward at the hips, lowering the bar along your legs.',
    type: 'strength',
    groupKey: 'legs',
    equipment: ['barbell'],
    difficulty: 'intermediate',
    imageURL: null,
  },
  {
    name: 'Leg Curl',
    description:
      'Lie face down on a leg curl machine and curl your heels toward your glutes.',
    type: 'strength',
    groupKey: 'legs',
    equipment: ['leg curl machine'],
    difficulty: 'beginner',
    imageURL: null,
  },
  {
    name: 'Leg Extension',
    description:
      'Sit on a leg extension machine and extend your knees to straighten your legs.',
    type: 'strength',
    groupKey: 'legs',
    equipment: ['leg extension machine'],
    difficulty: 'beginner',
    imageURL: null,
  },
  {
    name: 'Bulgarian Split Squat',
    description:
      'Stand with one foot on a bench behind you and squat down on the front leg.',
    type: 'strength',
    groupKey: 'legs',
    equipment: ['dumbbells', 'bench'],
    difficulty: 'intermediate',
    imageURL: null,
  },
  {
    name: 'Calf Raise',
    description:
      'Stand on the edge of a step and raise your heels by extending your ankles.',
    type: 'strength',
    groupKey: 'legs',
    equipment: [],
    difficulty: 'beginner',
    imageURL: null,
  },
  {
    name: 'Walking Lunge',
    description:
      'Step forward into a lunge, then bring the back foot forward and repeat alternating legs.',
    type: 'strength',
    groupKey: 'legs',
    equipment: ['dumbbells'],
    difficulty: 'beginner',
    imageURL: null,
  },

  // ── Core ─────────────────────────────────────────────────────────────────
  {
    name: 'Plank',
    description:
      'Hold a push-up position with your body in a straight line from head to heels.',
    type: 'bodyweight',
    groupKey: 'core',
    equipment: [],
    difficulty: 'beginner',
    imageURL: null,
  },
  {
    name: 'Hanging Leg Raise',
    description: 'Hang from a bar and raise your legs to a 90-degree angle.',
    type: 'bodyweight',
    groupKey: 'core',
    equipment: ['pull-up bar'],
    difficulty: 'intermediate',
    imageURL: null,
  },
  {
    name: 'Cable Crunch',
    description:
      'Kneel in front of a cable machine and crunch downward against the resistance.',
    type: 'strength',
    groupKey: 'core',
    equipment: ['cable machine'],
    difficulty: 'beginner',
    imageURL: null,
  },
  {
    name: 'Ab Wheel Rollout',
    description:
      'Kneel with an ab wheel and roll it forward, extending your body, then roll back.',
    type: 'bodyweight',
    groupKey: 'core',
    equipment: ['ab wheel'],
    difficulty: 'intermediate',
    imageURL: null,
  },
  {
    name: 'Russian Twist',
    description:
      'Sit with knees bent and feet off the floor, rotate your torso side to side.',
    type: 'bodyweight',
    groupKey: 'core',
    equipment: [],
    difficulty: 'beginner',
    imageURL: null,
  },
  {
    name: 'Dead Bug',
    description:
      'Lie on your back with arms and legs raised, then extend opposite arm and leg alternately.',
    type: 'bodyweight',
    groupKey: 'core',
    equipment: [],
    difficulty: 'beginner',
    imageURL: null,
  },

  // ── Cardio ───────────────────────────────────────────────────────────────
  {
    name: 'Running',
    description: 'Run at a steady pace outdoors or on a treadmill.',
    type: 'cardio',
    groupKey: 'cardio',
    equipment: [],
    difficulty: 'beginner',
    imageURL: null,
  },
  {
    name: 'Cycling',
    description:
      'Ride a stationary bike or bicycle at a moderate to high intensity.',
    type: 'cardio',
    groupKey: 'cardio',
    equipment: ['stationary bike'],
    difficulty: 'beginner',
    imageURL: null,
  },
  {
    name: 'Rowing',
    description:
      'Use a rowing machine with a full stroke from catch to finish.',
    type: 'cardio',
    groupKey: 'cardio',
    equipment: ['rowing machine'],
    difficulty: 'beginner',
    imageURL: null,
  },
  {
    name: 'Jump Rope',
    description:
      'Jump over a rope swung under your feet and over your head repeatedly.',
    type: 'cardio',
    groupKey: 'cardio',
    equipment: ['jump rope'],
    difficulty: 'beginner',
    imageURL: null,
  },
  {
    name: 'Stair Climber',
    description: 'Climb on a stair-climbing machine at a steady pace.',
    type: 'cardio',
    groupKey: 'cardio',
    equipment: ['stair climber'],
    difficulty: 'beginner',
    imageURL: null,
  },

  // ── Full Body ────────────────────────────────────────────────────────────
  {
    name: 'Burpee',
    description:
      'Drop into a push-up, then jump to your feet and leap upward with arms overhead.',
    type: 'bodyweight',
    groupKey: 'fullBody',
    equipment: [],
    difficulty: 'intermediate',
    imageURL: null,
  },
  {
    name: 'Kettlebell Swing',
    description:
      'Swing a kettlebell between your legs and up to chest height using hip drive.',
    type: 'strength',
    groupKey: 'fullBody',
    equipment: ['kettlebell'],
    difficulty: 'intermediate',
    imageURL: null,
  },
  {
    name: 'Clean and Press',
    description:
      'Lift a barbell from the floor to your shoulders (clean), then press it overhead.',
    type: 'strength',
    groupKey: 'fullBody',
    equipment: ['barbell'],
    difficulty: 'advanced',
    imageURL: null,
  },
  {
    name: 'Thruster',
    description:
      'Perform a front squat then drive the barbell overhead in one fluid motion.',
    type: 'strength',
    groupKey: 'fullBody',
    equipment: ['barbell'],
    difficulty: 'intermediate',
    imageURL: null,
  },
  {
    name: 'Mountain Climber',
    description:
      'In a plank position, rapidly alternate driving your knees toward your chest.',
    type: 'bodyweight',
    groupKey: 'fullBody',
    equipment: [],
    difficulty: 'beginner',
    imageURL: null,
  },
];
