-- Personal sent history seeks by author and time without scanning team history.
CREATE INDEX nook_personal_sent ON nook_messages(author,created DESC,id DESC) WHERE deleted=0;
