# A Facebook share link to a story says it's a story

## What

`facebook.com/share/1FvT4oZ33v/` (pasted by the owner) answered crawlers with a 302 to
`/stories/<id>/…`, then a 302 to `/login.php?next=<that story>`. `unwrapLoginWall` only
recognised `/login/`, so the walk ended on `login.php`. `isWalledFacebookShare` matched it, and the
visitor read "friends-only, in a private group, or deleted", which is wrong for a live public
story. Now `unwrapLoginWall` also reads `/login.php`, and `downloadFacebook` checks for a story
after the share hop as well as before it. The answer is `FACEBOOK_STORY` after one request (1.1 s
live from this machine), filed as `private`.

## Mistakes

- The 2026-11-20 walled-share work tested only shares that stay on `/share/`. "Ends at a login
  page" was treated as one case, when the login wall's `next` names where the link was going.
- `unwrapLoginWall` was written from Instagram's `/accounts/login/` and Facebook's `/login/`.
  Nobody checked which login path Facebook actually uses for stories (`/login.php`).

## What worked

- curl with crawler user agents showed the whole chain in one go, and the owner's signed-in
  Chrome confirmed the story was live (a photo, 960x1280). So the site's message, not Facebook,
  was the bug.

## Rules

- Before naming a reason for a share-link failure, follow the chain with a crawler user agent and
  read the `next` of any login wall.
