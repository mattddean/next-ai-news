import { TimeAgo } from "@/components/time-ago";
import { ReactNode, Suspense } from "react";
import { CommentFromDB } from "./actions";

export function CommentList({
  author,
  loggedInUserId,
  comments,
  MoreComments,
}: {
  author?: string;
  loggedInUserId?: string;
  comments: CommentFromDB[];
  MoreComments: ReactNode;
}) {
  return (
    <>
      <ul className="flex flex-col gap-3">
        {comments.map((comment, i) => (
          <CommentItem
            key={comment.id}
            i={i}
            loggedInUserId={loggedInUserId}
            author={author}
            comment={comment}
          />
        ))}
      </ul>
      <div className="mt-4 ml-7">{MoreComments}</div>
    </>
  );
}

function CommentItem({
  i,
  author,
  loggedInUserId,
  comment,
}: {
  i: number;
  author?: string;
  loggedInUserId?: string;
  comment: CommentFromDB;
}) {
  const now = Date.now();
  return (
    <li style={{ marginLeft: (comment.level - 1) * 30 }}>
      <div className="flex items-start">
        <div className="flex flex-col items-center mr-1 gap-y-1">
          {loggedInUserId === comment.author ? (
            <span className="text-2xl text-[#FF9966] cursor-pointer">*</span>
          ) : (
            <>
              <svg
                height="12"
                viewBox="0 0 32 16"
                width="12"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path d="m2 27 14-29 14 29z" fill="#999" />
              </svg>
              <svg
                className="transform rotate-180"
                height="12"
                viewBox="0 0 32 16"
                width="12"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path d="m2 27 14-29 14 29z" fill="#999" />
              </svg>
            </>
          )}
        </div>
        <div className="flex flex-col gap-3">
          <div>
            <p className="mb-1 text-sm text-gray-600">
              {comment.username}{" "}
              <TimeAgo date={new Date(comment.created_at)} now={now} />{" "}
              <span aria-hidden={true}>|</span>{" "}
              {i > 0 && (
                <>
                  <span title="Unimplemented">prev</span>{" "}
                  <span aria-hidden={true}>| </span>{" "}
                </>
              )}
              <span title="Unimplemented">next</span>
            </p>
            <p className="mb-1">
              {comment.id} {comment.comment}
            </p>
          </div>
        </div>
      </div>
    </li>
  );
}
