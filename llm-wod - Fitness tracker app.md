llm-wod - AI Generated workout timer and tracker
The basic idea is this: You input a simple onboarding page of the goals that you have in free text. Maybe you can have some examples like strength, fat loss, etc. Muscle size. You then pick the sets of equipment you have, e.g. you may have one set of equipment at home and another at the gym, and you'll be able to select these at run-time. And you can also input basic stuff like age, weight etc. So the main feature of the app after you've kind of set up your profile is to generate work outs and to do this you select which equipment you have access to and how much time you have and this will get sent along with your profile information to a large language model which will send back structured output that will include:

- The set of exercises you do
- How much time to do them in
- What sort of circuits and in target sort of like rep ranges

The idea is this: The structured output will allow the app to be able to set up timers for each exercise. The LLM might send back just as a simplified example: "You're going to do three rounds of push-ups for 30 seconds, squats for 30 seconds, and pull-ups for 30 seconds, with 10 second rest in between each exercise and a 90-second rest in between cycles." So the full structured output will be for each circuit, rounds and rest times for each exercise, total time and a rest between each exercise. And then, of course, there can be a multiple circuits and warm-ups and cool downs and things like that. So think about the schema that you would need to give the app all the information to display what exercise to do and how much time they'll have to do it and how much rest there is. A timer module that obviously displays the current exercise time, has some audio indicators like a 3-second countdown and then a beep to indicate your switching exercises. The display will be like: "How much time you have left", "What your current exercise is", "What's up next", etc. And the app knows if you've made it to the end or if you stop in the middle of it. It has rests between cycles that the LLM can decide for you to get water, etc

Track progress over time so the LLM can estimate how many calories you burned in a given exercise. When you prompt it, after doing the previous exercise, it knows your last has a summary of your last 3. It can either add some progressive overload or it can suggest variations to make sure you're getting enough variety of exercises, etc. 

Each exercise can actually have a hidden info button. When the user presses it, they can get a description of the exercise. 

After the exercise is generated, but before the user starts, they can review a UI that shows each step of the exercise in circuits and rounds, and things like that. Feedback field to the user that if they decide they don't want to use or they want to modify the workout in any way, they can just provide free text as feedback to the LLM. That will send a prompt back to the LLM that's like the user. This is the exercise you display to the user. The user's feedback was: Please regenerate the workout using the correct schema in order to satisfy the user's request. 

User can also just do basic manual tracking of their weight. 

example schema:

warm-up;
- e1_name: "arm circles";
- e1_time:30;
- e2_name: "air squats";
- e2_time:30;
circuit_1;
- rounds:3;
- rest_btwn_rounds:90;
- e1_name:"push ups, 7 - 10 reps";
- e1_time:60;
- e2_name:""
- e2_time:""
circuit_2;
- ...
- ...
- ...
cool-down;
- e1_name:"child's pose"
- e1_time:45
calories:300

AUDIO
- modern audio implementation. beep tones at transition with 3 second countdown, audio goes over any playing audio on device (e.g. spotify) without ducking

IMAGE: stretch goal, use google/gemini-3-pro-image-preview to generate minimal, instructive images of the exercise, a simple minimalist instructional image of a figure performing the exercise, with key arrows for movement, no text, just the figure performing the move, possibly with panels of different stages of the exercise
