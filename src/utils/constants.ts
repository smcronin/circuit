export const ALL_EQUIPMENT = [
  // Weights
  { id: 'dumbbells', name: 'Dumbbells', category: 'weights', icon: 'barbell-outline' },
  { id: 'kettlebell', name: 'Kettlebell', category: 'weights', icon: 'fitness-outline' },
  { id: 'barbell', name: 'Barbell', category: 'weights', icon: 'barbell' },
  { id: 'medicine_ball', name: 'Medicine Ball', category: 'weights', icon: 'basketball-outline' },
  { id: 'weight_plates', name: 'Weight Plates', category: 'weights', icon: 'ellipse-outline' },

  // Machines
  { id: 'cable_machine', name: 'Cable Machine', category: 'machines', icon: 'git-network-outline' },
  { id: 'rowing_machine', name: 'Rowing Machine', category: 'machines', icon: 'boat-outline' },
  { id: 'stationary_bike', name: 'Stationary Bike', category: 'machines', icon: 'bicycle-outline' },
  { id: 'treadmill', name: 'Treadmill', category: 'machines', icon: 'walk-outline' },
  { id: 'elliptical', name: 'Elliptical', category: 'machines', icon: 'footsteps-outline' },

  // Bodyweight
  { id: 'pull_up_bar', name: 'Pull-up Bar', category: 'bodyweight', icon: 'remove-outline' },
  { id: 'dip_bars', name: 'Dip Bars', category: 'bodyweight', icon: 'remove-outline' },
  { id: 'bench', name: 'Bench', category: 'bodyweight', icon: 'bed-outline' },
  { id: 'box_platform', name: 'Box/Platform', category: 'bodyweight', icon: 'cube-outline' },

  // Accessories
  { id: 'yoga_mat', name: 'Yoga Mat', category: 'accessories', icon: 'albums-outline' },
  { id: 'resistance_bands', name: 'Resistance Bands', category: 'accessories', icon: 'git-merge-outline' },
  { id: 'jump_rope', name: 'Jump Rope', category: 'accessories', icon: 'pulse-outline' },
  { id: 'foam_roller', name: 'Foam Roller', category: 'accessories', icon: 'ellipse-outline' },
  { id: 'ab_wheel', name: 'Ab Wheel', category: 'accessories', icon: 'radio-button-on-outline' },
  { id: 'trx_suspension', name: 'TRX/Suspension', category: 'accessories', icon: 'swap-vertical-outline' },
  { id: 'gymnastic_rings', name: 'Gymnastic Rings', category: 'accessories', icon: 'infinite-outline' },
  { id: 'weight_vest', name: 'Weight Vest', category: 'accessories', icon: 'body-outline' },
  { id: 'hangboard', name: 'Hangboard', category: 'accessories', icon: 'hand-left-outline' },
];

export const EQUIPMENT_CATEGORIES = [
  { id: 'weights', name: 'Free Weights' },
  { id: 'machines', name: 'Machines' },
  { id: 'bodyweight', name: 'Bodyweight' },
  { id: 'accessories', name: 'Accessories' },
];

export const EQUIPMENT_PRESETS = {
  bodyweight: {
    name: 'Bodyweight Only',
    description: 'No equipment needed',
    equipment: [],
  },
  minimal: {
    name: 'Minimal Home',
    description: 'Just the basics',
    equipment: ['yoga_mat', 'resistance_bands'],
  },
  home_basic: {
    name: 'Basic Home Gym',
    description: 'Common home equipment',
    equipment: ['dumbbells', 'yoga_mat', 'resistance_bands', 'pull_up_bar'],
  },
  home_complete: {
    name: 'Complete Home Gym',
    description: 'Well-equipped home gym',
    equipment: [
      'dumbbells',
      'kettlebell',
      'pull_up_bar',
      'bench',
      'yoga_mat',
      'resistance_bands',
      'jump_rope',
      'foam_roller',
    ],
  },
  gym: {
    name: 'Full Gym',
    description: 'Commercial gym access',
    equipment: [
      'barbell',
      'dumbbells',
      'kettlebell',
      'cable_machine',
      'bench',
      'pull_up_bar',
      'medicine_ball',
      'rowing_machine',
      'treadmill',
    ],
  },
};

export const DURATION_OPTIONS = [
  { value: 10, label: '10 min', description: 'Quick burst' },
  { value: 15, label: '15 min', description: 'Short & sweet' },
  { value: 20, label: '20 min', description: 'Focused session' },
  { value: 25, label: '25 min', description: 'Solid workout' },
  { value: 30, label: '30 min', description: 'Standard' },
  { value: 45, label: '45 min', description: 'Extended' },
  { value: 60, label: '60 min', description: 'Full session' },
];

export const GOAL_SUGGESTIONS = [
  'Build muscle and strength',
  'Lose fat and get lean',
  'Improve cardiovascular endurance',
  'Increase flexibility and mobility',
  'General fitness and health',
  'Train for sports performance',
  'Build functional strength',
  'Rehabilitation and injury prevention',
];

export const DIFFICULTY_COLORS = {
  beginner: '#22C55E',
  intermediate: '#EAB308',
  advanced: '#EF4444',
};

export const DIFFICULTY_LABELS = {
  beginner: 'Beginner',
  intermediate: 'Intermediate',
  advanced: 'Advanced',
};
