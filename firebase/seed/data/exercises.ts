import type { ExerciseSeed } from '../types';

const exercise = (
  slug: string,
  name: { en: string; uk: string },
  description: { en: string; uk: string },
  type: ExerciseSeed['type'],
  categorySlug: string,
  equipmentSlugs: string[] = []
): ExerciseSeed => ({
  slug,
  name,
  description,
  type,
  categoryRef: `global:${categorySlug}`,
  equipment: equipmentSlugs.map((equipmentSlug) => `global:${equipmentSlug}`),
  imageURL: null,
  isRetired: false,
});

export const exercises: ExerciseSeed[] = [
  exercise(
    'barbell-bench-press',
    { en: 'Barbell Bench Press', uk: 'Жим штанги лежачи' },
    {
      en: 'Lie on a flat bench and press a barbell upward from chest level to full arm extension.',
      uk: 'Ляжте на горизонтальну лаву та вичавіть штангу від грудей до повного випрямлення рук.',
    },
    'strength',
    'chest',
    ['barbell', 'bench']
  ),
  exercise(
    'incline-dumbbell-press',
    { en: 'Incline Dumbbell Press', uk: 'Жим гантелей на похилій лаві' },
    {
      en: 'Press dumbbells upward while lying on an incline bench set to 30-45 degrees.',
      uk: 'Вичавлюйте гантелі вгору, лежачи на лаві з нахилом 30-45 градусів.',
    },
    'strength',
    'chest',
    ['dumbbell', 'bench']
  ),
  exercise(
    'dumbbell-fly',
    { en: 'Dumbbell Fly', uk: 'Розведення гантелей лежачи' },
    {
      en: 'Lie on a flat bench with dumbbells above your chest, then lower them to the sides in a wide arc.',
      uk: 'Лежачи на лаві з гантелями над грудьми, опускайте їх у сторони широкою дугою.',
    },
    'strength',
    'chest',
    ['dumbbell', 'bench']
  ),
  exercise(
    'cable-crossover',
    { en: 'Cable Crossover', uk: 'Зведення рук у кросовері' },
    {
      en: 'Stand between cable pulleys and bring the handles together in front of your chest.',
      uk: 'Станьте між блоками та зведіть руків’я перед грудьми.',
    },
    'strength',
    'chest',
    ['cable-machine']
  ),
  exercise(
    'push-up',
    { en: 'Push-Up', uk: 'Віджимання' },
    {
      en: 'Start in a plank, lower your chest close to the floor, then push back up.',
      uk: 'Почніть у планці, опустіть груди майже до підлоги та відштовхніться вгору.',
    },
    'bodyweight',
    'chest'
  ),
  exercise(
    'chest-dip',
    { en: 'Dips (Chest)', uk: 'Віджимання на брусах для грудей' },
    {
      en: 'Lean forward on parallel bars, lower your body by bending your arms, then push up.',
      uk: 'Нахиліться вперед на брусах, опустіть тіло, згинаючи руки, і виштовхніться вгору.',
    },
    'bodyweight',
    'chest',
    ['dip-bars']
  ),
  exercise(
    'deadlift',
    { en: 'Deadlift', uk: 'Станова тяга' },
    {
      en: 'Lift a loaded barbell from the floor to hip level by extending your hips and knees.',
      uk: 'Підніміть штангу з підлоги до рівня стегон, розгинаючи тазостегнові суглоби й коліна.',
    },
    'strength',
    'back',
    ['barbell']
  ),
  exercise(
    'barbell-row',
    { en: 'Barbell Row', uk: 'Тяга штанги в нахилі' },
    {
      en: 'Hinge at the hips with arms extended, then pull the barbell toward your lower chest.',
      uk: 'Нахиліться в тазостегнових суглобах і підтягніть штангу до нижньої частини грудей.',
    },
    'strength',
    'back',
    ['barbell']
  ),
  exercise(
    'pull-up',
    { en: 'Pull-Up', uk: 'Підтягування' },
    {
      en: 'Hang with an overhand grip and pull yourself up until your chin is above the bar.',
      uk: 'Повисніть прямим хватом і підтягніться, доки підборіддя не опиниться над перекладиною.',
    },
    'bodyweight',
    'back',
    ['pull-up-bar']
  ),
  exercise(
    'lat-pulldown',
    { en: 'Lat Pulldown', uk: 'Тяга верхнього блока' },
    {
      en: 'Sit at a cable machine and pull the bar down toward your upper chest.',
      uk: 'Сядьте за блочний тренажер і потягніть перекладину до верхньої частини грудей.',
    },
    'strength',
    'back',
    ['cable-machine']
  ),
  exercise(
    'seated-cable-row',
    { en: 'Seated Cable Row', uk: 'Горизонтальна тяга блока' },
    {
      en: 'Sit at a cable row station and pull the handle to your torso while keeping your back straight.',
      uk: 'Сидячи біля нижнього блока, тягніть руків’я до тулуба, тримаючи спину рівною.',
    },
    'strength',
    'back',
    ['cable-machine']
  ),
  exercise(
    'single-arm-dumbbell-row',
    { en: 'Dumbbell Single-Arm Row', uk: 'Тяга гантелі однією рукою' },
    {
      en: 'Brace one knee and hand on a bench, then row a dumbbell toward your hip.',
      uk: 'Упріться коліном і рукою в лаву та тягніть гантелю іншою рукою до стегна.',
    },
    'strength',
    'back',
    ['dumbbell', 'bench']
  ),
  exercise(
    'overhead-press',
    { en: 'Overhead Press', uk: 'Жим штанги над головою' },
    {
      en: 'Press a barbell from shoulder height to overhead with full arm extension.',
      uk: 'Вичавіть штангу від рівня плечей над головою до повного випрямлення рук.',
    },
    'strength',
    'shoulders',
    ['barbell']
  ),
  exercise(
    'dumbbell-lateral-raise',
    { en: 'Dumbbell Lateral Raise', uk: 'Розведення гантелей у сторони' },
    {
      en: 'Stand with dumbbells at your sides and raise them outward to shoulder height.',
      uk: 'Стоячи з гантелями вздовж тіла, піднімайте їх у сторони до рівня плечей.',
    },
    'strength',
    'shoulders',
    ['dumbbell']
  ),
  exercise(
    'dumbbell-front-raise',
    { en: 'Dumbbell Front Raise', uk: 'Підйом гантелей перед собою' },
    {
      en: 'Stand with dumbbells by your thighs and raise them forward to shoulder height.',
      uk: 'Стоячи з гантелями біля стегон, піднімайте їх перед собою до рівня плечей.',
    },
    'strength',
    'shoulders',
    ['dumbbell']
  ),
  exercise(
    'face-pull',
    { en: 'Face Pull', uk: 'Тяга каната до обличчя' },
    {
      en: 'Pull a rope attachment toward your face while separating its ends.',
      uk: 'Тягніть канатне руків’я до обличчя, розводячи його кінці.',
    },
    'strength',
    'shoulders',
    ['cable-machine']
  ),
  exercise(
    'arnold-press',
    { en: 'Arnold Press', uk: 'Жим Арнольда' },
    {
      en: 'Start with dumbbells at chin height, rotate your palms outward, and press overhead.',
      uk: 'Почніть із гантелями біля підборіддя, розверніть долоні назовні та вичавіть вагу вгору.',
    },
    'strength',
    'shoulders',
    ['dumbbell']
  ),
  exercise(
    'reverse-dumbbell-fly',
    { en: 'Reverse Dumbbell Fly', uk: 'Зворотне розведення гантелей' },
    {
      en: 'Hinge forward and raise dumbbells out to the sides to target the rear deltoids.',
      uk: 'Нахиліться вперед і розводьте гантелі в сторони, навантажуючи задні дельти.',
    },
    'strength',
    'shoulders',
    ['dumbbell']
  ),
  exercise(
    'barbell-curl',
    { en: 'Barbell Curl', uk: 'Згинання рук зі штангою' },
    {
      en: 'Stand with a barbell and curl it upward by flexing your elbows.',
      uk: 'Стоячи зі штангою, піднімайте її вгору, згинаючи руки в ліктях.',
    },
    'strength',
    'arms',
    ['barbell']
  ),
  exercise(
    'dumbbell-hammer-curl',
    { en: 'Dumbbell Hammer Curl', uk: 'Молоткові згинання з гантелями' },
    {
      en: 'Curl dumbbells while keeping your palms facing each other.',
      uk: 'Згинайте руки з гантелями, тримаючи долоні спрямованими одна до одної.',
    },
    'strength',
    'arms',
    ['dumbbell']
  ),
  exercise(
    'triceps-pushdown',
    { en: 'Tricep Pushdown', uk: 'Розгинання рук на верхньому блоці' },
    {
      en: 'Push a cable attachment down by extending your elbows while keeping your upper arms still.',
      uk: 'Тисніть руків’я блока вниз, розгинаючи лікті та не рухаючи плечима.',
    },
    'strength',
    'arms',
    ['cable-machine']
  ),
  exercise(
    'skull-crusher',
    { en: 'Skull Crusher', uk: 'Французький жим лежачи' },
    {
      en: 'Lie on a bench, lower an EZ bar toward your forehead by bending your elbows, then extend.',
      uk: 'Лежачи на лаві, опускайте EZ-гриф до чола, згинаючи лікті, а потім розгинайте руки.',
    },
    'strength',
    'arms',
    ['ez-bar', 'bench']
  ),
  exercise(
    'concentration-curl',
    { en: 'Concentration Curl', uk: 'Концентроване згинання руки' },
    {
      en: 'Sit, brace your elbow against your inner thigh, and curl a dumbbell.',
      uk: 'Сядьте, упріться ліктем у внутрішню частину стегна та піднімайте гантелю.',
    },
    'strength',
    'arms',
    ['dumbbell', 'bench']
  ),
  exercise(
    'overhead-triceps-extension',
    {
      en: 'Overhead Tricep Extension',
      uk: 'Розгинання рук із гантеллю над головою',
    },
    {
      en: 'Hold a dumbbell overhead with both hands and lower it behind your head by bending your elbows.',
      uk: 'Тримайте гантелю двома руками над головою та опускайте її за голову, згинаючи лікті.',
    },
    'strength',
    'arms',
    ['dumbbell']
  ),
  exercise(
    'barbell-squat',
    { en: 'Barbell Squat', uk: 'Присідання зі штангою' },
    {
      en: 'With a barbell on your upper back, squat until your thighs are parallel, then stand.',
      uk: 'Тримаючи штангу на верхній частині спини, присядьте до паралелі стегон і встаньте.',
    },
    'strength',
    'legs',
    ['barbell', 'squat-rack']
  ),
  exercise(
    'leg-press',
    { en: 'Leg Press', uk: 'Жим ногами' },
    {
      en: 'Sit in a leg press machine and push the platform away by extending your knees and hips.',
      uk: 'Сядьте в тренажер і відштовхуйте платформу, розгинаючи коліна й тазостегнові суглоби.',
    },
    'strength',
    'legs',
    ['leg-press-machine']
  ),
  exercise(
    'romanian-deadlift',
    { en: 'Romanian Deadlift', uk: 'Румунська станова тяга' },
    {
      en: 'Hold a barbell at hip height and hinge forward, lowering it close to your legs.',
      uk: 'Тримайте штангу біля стегон і нахиляйтеся вперед, опускаючи її вздовж ніг.',
    },
    'strength',
    'legs',
    ['barbell']
  ),
  exercise(
    'leg-curl',
    { en: 'Leg Curl', uk: 'Згинання ніг у тренажері' },
    {
      en: 'Lie face down on a leg curl machine and curl your heels toward your glutes.',
      uk: 'Ляжте обличчям униз у тренажері та згинайте ноги, наближаючи п’яти до сідниць.',
    },
    'strength',
    'legs',
    ['leg-curl-machine']
  ),
  exercise(
    'leg-extension',
    { en: 'Leg Extension', uk: 'Розгинання ніг у тренажері' },
    {
      en: 'Sit in a leg extension machine and straighten your legs by extending your knees.',
      uk: 'Сядьте в тренажер і випрямляйте ноги, розгинаючи коліна.',
    },
    'strength',
    'legs',
    ['leg-extension-machine']
  ),
  exercise(
    'bulgarian-split-squat',
    { en: 'Bulgarian Split Squat', uk: 'Болгарські спліт-присідання' },
    {
      en: 'Place one foot on a bench behind you and squat on the front leg.',
      uk: 'Поставте одну стопу на лаву позаду та присідайте на передній нозі.',
    },
    'strength',
    'legs',
    ['dumbbell', 'bench']
  ),
  exercise(
    'calf-raise',
    { en: 'Calf Raise', uk: 'Підйом на носки' },
    {
      en: 'Stand on the edge of a step and raise your heels by extending your ankles.',
      uk: 'Станьте на край платформи та піднімайте п’яти, розгинаючи гомілковостопні суглоби.',
    },
    'strength',
    'legs'
  ),
  exercise(
    'walking-lunge',
    { en: 'Walking Lunge', uk: 'Випади в русі' },
    {
      en: 'Step into a lunge, bring the rear foot forward, and repeat with alternating legs.',
      uk: 'Зробіть випад уперед, підтягніть задню ногу та повторюйте, чергуючи ноги.',
    },
    'strength',
    'legs',
    ['dumbbell']
  ),
  exercise(
    'plank',
    { en: 'Plank', uk: 'Планка' },
    {
      en: 'Hold your body in a straight line from head to heels while supported on your arms.',
      uk: 'Утримуйте тіло на руках по прямій лінії від голови до п’ят.',
    },
    'bodyweight',
    'core'
  ),
  exercise(
    'hanging-leg-raise',
    { en: 'Hanging Leg Raise', uk: 'Підйом ніг у висі' },
    {
      en: 'Hang from a bar and raise your legs toward a 90-degree angle.',
      uk: 'Повисніть на перекладині та піднімайте ноги до кута приблизно 90 градусів.',
    },
    'bodyweight',
    'core',
    ['pull-up-bar']
  ),
  exercise(
    'cable-crunch',
    { en: 'Cable Crunch', uk: 'Скручування на верхньому блоці' },
    {
      en: 'Kneel in front of a cable machine and crunch downward against the resistance.',
      uk: 'Станьте на коліна перед блоком і виконуйте скручування вниз проти опору.',
    },
    'strength',
    'core',
    ['cable-machine']
  ),
  exercise(
    'ab-wheel-rollout',
    { en: 'Ab Wheel Rollout', uk: 'Викочування ролика для преса' },
    {
      en: 'Kneel with an ab wheel, roll forward to extend your body, then return.',
      uk: 'Стоячи на колінах із роликом, прокотіть його вперед, витягніть тіло та поверніться.',
    },
    'bodyweight',
    'core',
    ['ab-wheel']
  ),
  exercise(
    'russian-twist',
    { en: 'Russian Twist', uk: 'Російські скручування' },
    {
      en: 'Sit with bent knees and rotate your torso from side to side.',
      uk: 'Сядьте із зігнутими колінами та повертайте тулуб із боку в бік.',
    },
    'bodyweight',
    'core'
  ),
  exercise(
    'dead-bug',
    { en: 'Dead Bug', uk: 'Мертвий жук' },
    {
      en: 'Lie on your back and alternately extend the opposite arm and leg.',
      uk: 'Ляжте на спину та почергово випрямляйте протилежні руку й ногу.',
    },
    'bodyweight',
    'core'
  ),
  exercise(
    'running',
    { en: 'Running', uk: 'Біг' },
    {
      en: 'Run at a steady pace outdoors or on a treadmill.',
      uk: 'Біжіть у рівномірному темпі надворі або на біговій доріжці.',
    },
    'cardio',
    'cardio'
  ),
  exercise(
    'cycling',
    { en: 'Cycling', uk: 'Їзда на велосипеді' },
    {
      en: 'Ride a stationary bike or bicycle at moderate to high intensity.',
      uk: 'Їдьте на велотренажері або велосипеді з помірною чи високою інтенсивністю.',
    },
    'cardio',
    'cardio',
    ['stationary-bike']
  ),
  exercise(
    'rowing',
    { en: 'Rowing', uk: 'Веслування' },
    {
      en: 'Use a rowing machine with a complete stroke from the catch to the finish.',
      uk: 'Працюйте на гребному тренажері повним рухом від захвату до завершення гребка.',
    },
    'cardio',
    'cardio',
    ['rowing-machine']
  ),
  exercise(
    'jump-rope',
    { en: 'Jump Rope', uk: 'Стрибки на скакалці' },
    {
      en: 'Jump repeatedly over a rope as it passes under your feet.',
      uk: 'Безперервно перестрибуйте через скакалку, коли вона проходить під ногами.',
    },
    'cardio',
    'cardio',
    ['jump-rope']
  ),
  exercise(
    'stair-climber',
    { en: 'Stair Climber', uk: 'Ходьба на степері' },
    {
      en: 'Climb on a stair-climbing machine at a steady pace.',
      uk: 'Підіймайтеся на степері в рівномірному темпі.',
    },
    'cardio',
    'cardio',
    ['stair-climber']
  ),
  exercise(
    'burpee',
    { en: 'Burpee', uk: 'Берпі' },
    {
      en: 'Drop into a push-up, return to your feet, and jump upward with your arms overhead.',
      uk: 'Перейдіть у віджимання, поверніться на ноги та вистрибніть угору з руками над головою.',
    },
    'bodyweight',
    'full-body'
  ),
  exercise(
    'kettlebell-swing',
    { en: 'Kettlebell Swing', uk: 'Махи гирею' },
    {
      en: 'Swing a kettlebell between your legs and up to chest height using hip drive.',
      uk: 'Розгойдуйте гирю між ногами та до рівня грудей за рахунок потужного руху стегон.',
    },
    'strength',
    'full-body',
    ['kettlebell']
  ),
  exercise(
    'clean-and-press',
    { en: 'Clean and Press', uk: 'Підйом штанги на груди та жим' },
    {
      en: 'Lift a barbell from the floor to your shoulders, then press it overhead.',
      uk: 'Підніміть штангу з підлоги на плечі, а потім вичавіть її над головою.',
    },
    'strength',
    'full-body',
    ['barbell']
  ),
  exercise(
    'thruster',
    { en: 'Thruster', uk: 'Трастер' },
    {
      en: 'Perform a front squat and drive the barbell overhead in one continuous motion.',
      uk: 'Виконайте фронтальне присідання та одним безперервним рухом виштовхніть штангу над головою.',
    },
    'strength',
    'full-body',
    ['barbell']
  ),
  exercise(
    'mountain-climber',
    { en: 'Mountain Climber', uk: 'Альпініст' },
    {
      en: 'From a plank, rapidly alternate driving your knees toward your chest.',
      uk: 'Із положення планки швидко та почергово підтягуйте коліна до грудей.',
    },
    'bodyweight',
    'full-body'
  ),
];
