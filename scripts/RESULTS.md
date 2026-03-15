# Chat instruction timing results

User prompt: **"What are rainbows?"**  
Response times in **milliseconds**. Multiple runs shown as `first / second` when available.

## Response time by model and parts


| Model                      | body only       | body + targetAudience | + responseRequirements | + outputRules | + contextAndClose |
| -------------------------- | --------------- | --------------------- | ---------------------- | ------------- | ----------------- |
| **gemini-2.5-flash**       | 7,788 / 7,708   | 6,235                 | 6,227                  | 6,879         | 6,278             |
| **gemini-3.1-flash-lite-preview** | 3,953   | 3,807                 | 2,847                  | 3,001         | 2,751             |
| **gemini-3-flash-preview** | 6,645           | 7,128                 | 7,798                  | 8,353         | 6,546             |
| **gemini-3-pro-preview**   | 16,557          | —                     | —                      | —             | —                 |
| **gemini-3.1-pro-preview** | 14,471 / 12,324 | —                     | —                      | —             | —                 |
| **deepseek-chat**          | 15,596          | —                     | —                      | —             | —                 |
| **deepseek-reasoner**      | 19,035          | —                     | —                      | —             | —                 |


Fill in columns as you run with more `PARTS_INCLUDED` in `gemini-test.js` or `deepseek-test.js`.

## Notes

- **Gemini 3.x pro preview**: Responses include non-text parts (`thoughtSignature`). SDK returns concatenation of text parts only.
- **gemini-3.1-flash-lite-preview**: Earlier run with body + targetAudience + outputRules (responseRequirements skipped) was 3,070 ms.
- **DeepSeek**: Set `MODEL` in `deepseek-test.js` (e.g. `deepseek-chat`, `deepseek-reasoner`). Body-only runs: deepseek-chat 25.2 s / 15.6 s / 15.6 s; deepseek-reasoner 19.0 s.

---

## Sample runs (terminal output)

<details>
<summary>Click to expand: full terminal output (lines 7–189)</summary>

```text
neilvaidya@Neils-MacBook-Air Owlby-api % node ./scripts/gemini-test.js
Parts included: body | targetAudience | responseRequirements
Model: gemini-2.5-flash
---
Response time: 6227 ms
---
A **rainbow** is a beautiful arc of colors that appears in the sky when **sunlight** shines through tiny **water droplets** in the air. You often see them after it rains, or sometimes near a waterfall or a sprinkler.

Here's how rainbows form:

*   **Sunlight is made of colors:** Even though sunlight looks white to us, it is actually made up of all the different colors of the rainbow mixed together.
*   **Light bends (Refraction):** When sunlight enters a tiny **water droplet** (like a raindrop), it slows down and **bends**. This bending of light as it passes from one material to another (like air into water) is called **refraction**. As the light bends, it also starts to spread out into its different colors, just like a prism does.
*   **Light bounces (Reflection):** After bending, the light then hits the back of the water droplet and **bounces back** towards your eyes. This bouncing of light is called **reflection**.
*   **Colors separate:** Each color in the sunlight bends at a slightly different angle when it enters and leaves the water droplet. This is why you see the colors separated into a beautiful arc.

The colors of a rainbow always appear in the same order: red, orange, yellow, green, blue, indigo, and violet. This band of colors is called the **spectrum** of light. For you to see a rainbow, the sun needs to be behind you, and the water droplets need to be in front of you.
neilvaidya@Neils-MacBook-Air Owlby-api % node ./scripts/gemini-test.js
Parts included: body | targetAudience | responseRequirements | outputRules
Model: gemini-2.5-flash
---
Response time: 6879 ms
---
    ```json
    {
      "response_text": {
        "main": "A rainbow is a beautiful arc of colors that appears in the sky when **sunlight** shines through tiny **raindrops** or mist. It's a wonderful natural event you can often see after it rains.\n\nHere's how it works: sunlight, which looks white to us, is actually made up of all the colors of the rainbow. When sunlight passes through a raindrop, the raindrop acts like a tiny **prism**. A prism is something that bends light and separates it into its different colors. Each raindrop bends and separates the white sunlight into the colors Red, Orange, Yellow, Green, Blue, Indigo, and Violet. When millions of these raindrops do this at the same time and the light comes back to your eyes, you see a magnificent rainbow in the sky!",
        "follow_up": "Why do rainbows always look like a curve or an arc?"
      },
      "interactive_elements": {
        "followup_buttons": [
          "Double rainbows",
          "Make a rainbow",
          "Light and color"
        ],
        "learn_more": {
          "topic": "Light and color"
        },
        "story_button": {
          "prompt": "a person seeing a rainbow"
        }
      }
    }
    ```
neilvaidya@Neils-MacBook-Air Owlby-api % node ./scripts/gemini-test.js
Parts included: body | targetAudience | responseRequirements | outputRules | contextAndClose
Model: gemini-2.5-flash
---
Response time: 6278 ms
---
    ```json
    {
      "response_text": {
        "main": "Rainbows are beautiful arcs of color that appear in the sky when sunlight shines through tiny **water droplets** in the air. Think of them like a natural light show! For a rainbow to appear, you need two things: sunshine and water droplets, often found in the air after it has rained, or sometimes near waterfalls or mist.\n\nThe magic happens because these tiny water droplets act like very small **prisms**. When **white light** from the sun hits these droplets, the light bends and separates into all the different colors that make it up. White light isn't just one color; it's actually a mix of many colors, like red, orange, yellow, green, blue, indigo, and violet. Each color bends at a slightly different angle, which is why we see them spread out.\n\nSo, as the sunlight enters a water droplet, it bends, then bounces off the back of the droplet, and bends again as it leaves the droplet and travels to your eyes. This process creates the gorgeous band of colors we call a rainbow. The order of the colors is always the same: red on the outside and violet on the inside.",
        "follow_up": "Did you know that you can sometimes see a double rainbow, or even make your own small rainbow with a garden hose?"
      },
      "interactive_elements": {
        "followup_buttons": [
          "How can I make one?",
          "Why are they curved?",
          "What are prisms?"
        ],
        "learn_more": {
          "topic": "Light and color"
        },
        "story_button": {
          "prompt": "a rainbow appearing"
        }
      }
    }
    ```
neilvaidya@Neils-MacBook-Air Owlby-api % node ./scripts/gemini-test.js
Parts included: body
Model: gemini-3.1-flash-lite-preview
---
there are non-text parts thoughtSignature in the response, returning concatenation of all text parts. Please refer to the non text parts for a full response from model.
Response time: 3953 ms
---
A rainbow is a beautiful optical phenomenon that occurs when sunlight interacts with water droplets in the atmosphere. To understand how they form, you need to look at two scientific principles: **refraction** and **reflection**.

### The Ingredients
To see a rainbow, you generally need two things at the same time: the sun must be shining, and there must be water droplets in the air—usually from a recent rain shower. You must also be positioned with the sun behind you and the rain in front of you.

### The Process
1.  **Refraction (Bending):** Sunlight looks white, but it is actually composed of all the colors of the visible spectrum (red, orange, yellow, green, blue, indigo, and violet). As a beam of sunlight enters a spherical raindrop, it slows down and bends. Because each color travels at a slightly different wavelength, they each bend at a slightly different angle. This process is called dispersion, and it separates the white light into its individual colors.
2.  **Reflection (Bouncing):** Once the light enters the raindrop, it hits the back surface of the drop. Instead of passing through, it reflects—much like a mirror—off the back of the droplet and heads back toward the front.
3.  **Refraction (Exiting):** As the light leaves the raindrop, it bends one more time. This further spreads out the colors, making them visible to your eyes.

### Why is it a bow?
Each raindrop reflects and refracts all the colors, but your eyes only catch specific colors from specific drops depending on the angle at which you are standing. Raindrops higher in the sky send the red light to your eyes, while drops lower down send the violet light. Because the raindrops are essentially circular, this pattern of light forms a perfect arc in the sky.

If you were ever in an airplane or on a very high mountain, you might be able to see that a rainbow is actually a full circle rather than just an arc. The ground usually blocks the bottom half from our view when we are standing on the surface of the Earth.

Does the science behind light and color spark any other questions for you? I am happy to dive deeper into how prisms work or why we see colors the way we do.
neilvaidya@Neils-MacBook-Air Owlby-api % node ./scripts/gemini-test.js
Parts included: body | targetAudience
Model: gemini-3.1-flash-lite-preview
---
there are non-text parts thoughtSignature in the response, returning concatenation of all text parts. Please refer to the non text parts for a full response from model.
Response time: 3807 ms
---
A rainbow is an incredible display of light and color that happens because of the way sunlight interacts with raindrops in the sky. To understand how they form, we have to look at two important concepts: light and refraction.

### 1. Sunlight is made of all colors
Even though sunlight looks white to our eyes, it is actually a mixture of every color in the rainbow. Think of white light as a "package" that contains red, orange, yellow, green, blue, indigo, and violet.

### 2. Water acts like a prism
When sunlight enters a raindrop, the light slows down and bends. This process of bending is called **refraction**. Because each color inside the sunlight travels at a slightly different wavelength, each color bends at a slightly different angle. This causes the white light to spread out, revealing all the individual colors hidden inside.

### 3. Reflection
Once the light has been split into colors, it hits the back of the raindrop and reflects (bounces) off it, just like light bouncing off a mirror.

### 4. The Exit
As the light exits the raindrop, it bends again and spreads out even more. When thousands of raindrops do this at the same time, we see a beautiful arc of color across the sky.

### How can you see one?
To spot a rainbow, you need two things:
*   **Sunlight:** You need the sun to be shining.
*   **Rain:** You need water droplets in the air in front of you.

This is why rainbows usually appear when it is raining in one part of the sky while the sun is shining in another. You must always have the sun behind you and the rain in front of you to see the colors.

If you are ever curious, you can make your own rainbow using a garden hose! If you stand with your back to the sun and spray a fine mist of water into the air, you will often see a miniature rainbow right in front of you.

Do you know the common acronym used to remember the order of the colors in a rainbow?
neilvaidya@Neils-MacBook-Air Owlby-api % node ./scripts/gemini-test.js
Parts included: body | targetAudience | responseRequirements
Model: gemini-3.1-flash-lite-preview
---
there are non-text parts thoughtSignature in the response, returning concatenation of all text parts. Please refer to the non text parts for a full response from model.
Response time: 2847 ms
---
A rainbow is an optical phenomenon that happens when sunlight interacts with water droplets in the atmosphere. To understand how they form, you have to look at two main scientific processes: **refraction** and **reflection**.

Here is how it works:

- **Refraction:** When sunlight enters a raindrop, it slows down and bends. Because white light is actually made up of all the colors of the rainbow, each color bends at a slightly different angle. This causes the white light to separate into its individual colors: red, orange, yellow, green, blue, indigo, and violet.
- **Reflection:** Once the light has separated, it hits the back of the raindrop like a mirror and bounces back.
- **Exiting the drop:** As the light leaves the raindrop, it **refracts** a second time. This further spreads out the colors, allowing us to see them clearly against the sky.

For you to see a rainbow, two conditions must be met:
1. The sun must be behind you.
2. There must be water droplets (like rain or mist) in front of you.

Each person sees their own unique rainbow. Because of the specific angle required to see the light reflecting off the droplets, the rainbow you see is positioned specifically for your eyes. If you move, the light reflects off different droplets, which means the rainbow appears to move with you.

A rainbow is a full circle, but because we usually stand on the ground, the horizon blocks the bottom half. If you were in a high-altitude airplane, you might be lucky enough to see a rainbow as a complete, circular loop.
neilvaidya@Neils-MacBook-Air Owlby-api % node ./scripts/gemini-test.js
Parts included: body | targetAudience | responseRequirements | outputRules
Model: gemini-3.1-flash-lite-preview
---
there are non-text parts thoughtSignature in the response, returning concatenation of all text parts. Please refer to the non text parts for a full response from model.
Response time: 3001 ms
---
{
  "response_text": {
    "main": "A **rainbow** is a colorful arc that appears in the sky when sunlight interacts with water droplets. This phenomenon occurs through a process called **refraction**, which happens when light enters a raindrop and bends. Because white light is actually made up of many different colors, the water droplet acts like a tiny prism, causing the light to separate into its individual spectrum of red, orange, yellow, green, blue, indigo, and violet.\n\nTo see a rainbow, you must have the sun behind you and rain falling in front of you. The light enters the water droplets, reflects off the back of them, and then exits, sending that beautiful band of color toward your eyes. This is why rainbows are often spotted right after a rainstorm when the sun begins to peek back through the clouds.",
    "follow_up": "Would you like to learn about the specific order of the colors in a rainbow?"
  },
  "interactive_elements": {
    "followup_buttons": [
      "Why is it a circle?",
      "Can I make a rainbow?"
    ],
    "learn_more": {
      "topic": "Light reflection"
    },
    "story_button": {
      "prompt": "a scientist discovering how light bends"
    }
  }
}
neilvaidya@Neils-MacBook-Air Owlby-api % node ./scripts/gemini-test.js
Parts included: body | targetAudience | responseRequirements | outputRules | contextAndClose
Model: gemini-3.1-flash-lite-preview
---
there are non-text parts thoughtSignature in the response, returning concatenation of all text parts. Please refer to the non text parts for a full response from model.
Response time: 2751 ms
---
{
  "response_text": {
    "main": "A **rainbow** is a colorful arc that appears in the sky when sunlight interacts with water droplets. This happens because of a process called **refraction**, which occurs when light enters a raindrop and bends. As the light bends, it separates into different colors. The colors then bounce off the back of the raindrop, a process called **reflection**, and travel back to your eyes in an orderly band.\n\nTo see a rainbow, the sun must be behind you and the rain must be in front of you. White light from the sun is actually made up of all the colors of the rainbow, which are red, orange, yellow, green, blue, indigo, and violet. When the light hits the water at just the right angle, these colors spread out to form the beautiful spectrum we recognize.",
    "follow_up": "Would you like to know why rainbows are always shaped like an arc instead of a straight line?"
  },
  "interactive_elements": {
    "followup_buttons": [
      "Why an arc?",
      "Can I make one?"
    ],
    "learn_more": {
      "topic": "The science of light and color"
    },
    "story_button": {
      "prompt": "a prism catching sunlight"
    }
  }
}
neilvaidya@Neils-MacBook-Air Owlby-api %
```
</details>

---

*Ignore cancelled runs and path typos. Use `node scripts/deepseek-test.js` and `node scripts/gemini-test.js`.*